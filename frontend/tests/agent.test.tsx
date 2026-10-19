import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CarbonResultPanel } from '../src/components/CarbonAccountingView';
import { AgentResultPanel } from '../src/components/TransitionCopilotView';
import { getAgent, isCarbonResult, Objective, resumeAgent, startAgent } from '../src/services/agent';
import { resumeIntake, startIntake } from '../src/services/intake';

const objective = (mode: Objective['mode']): Objective => ({ mode, focus: 'BALANCED', description: 'Review supplied evidence',
  constraints: {}, funding: { mode: 'CASH_ONLY', grant_amount: null, maximum_sme_contribution: null, terms: null }, action_ids: [] });
const csv = 'company_id,reporting_year,revenue,operating_expenses,cash_balance,annual_debt_service,capex_budget,minimum_cash_reserve,electricity_kwh,diesel_litres,petrol_litres,natural_gas_m3,lpg_kg,reporting_period\nTEST,2024,10000,7000,2000,500,1000,500,100,0,0,0,0,2024';

test('Phase 1 intake → real MainAgent services/interrupts/trace → copilot result', { timeout: 60000 }, async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  const target = `http://127.0.0.1:${port}`;
  const child = spawn(process.env.PYTHON || 'python', ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), windowsHide: true,
    env: { ...process.env, GEMINI_API_KEY: '', GOOGLE_API_KEY: '', GREENBRIDGE_CARBON_SERVICE: '',
      GREENBRIDGE_FINANCIAL_SERVICE: '', GREENBRIDGE_TRANSITION_SERVICE: '' }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let log = '';
  let spawnError: Error | undefined;
  child.stderr.on('data', chunk => { log = (log + chunk).slice(-3000); });
  child.on('error', error => { spawnError = error; });
  const nativeFetch = globalThis.fetch;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(`Backend exited: ${log}`);
      try { ready = (await nativeFetch(`${target}/health`)).ok; } catch { /* Startup only. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, log);
    // Keep real HTTP and the application client, redirect only to this test port.
    globalThis.fetch = (input, options) => nativeFetch(String(input).replace(/^https?:\/\/[^/]+/, target), options);
    const intake = await startIntake([new File([csv], 'real-runtime.csv')], 'Runtime reviewer',
      ['carbon_analysis', 'financial_analysis', 'transition_analysis'], { quality: 'DIRECT_MEASURED', basis: 'Supplied source export' });
    assert.equal(intake.result.agent_next_action, 'PROCEED');

    const plan = await startAgent(intake, objective('PLAN_TRANSITION'));
    assert.deepEqual(plan.result.intake_result, intake.result);
    assert.equal(plan.result.status, 'NEEDS_CONTEXT');
    assert.equal(plan.awaiting, 'context');
    assert.equal(plan.result.recommendation, null);
    assert.equal(plan.service_status.get_carbon_analysis, 'AVAILABLE');
    assert.equal(plan.service_status.get_transition_options, 'SERVICE_UNAVAILABLE');
    assert.equal(plan.service_status.get_financial_analysis, 'AVAILABLE');
    const carbon = plan.result.tool_results.get_carbon_analysis.data;
    assert.ok(isCarbonResult(carbon));
    assert.equal(carbon.reporting_year, 2024);
    assert.equal(carbon.scope2_emissions_tco2e, 0.0584);
    assert.equal(carbon.total_tco2e, 0.0584);
    const carbonMarkup = renderToStaticMarkup(<CarbonResultPanel result={carbon} />);
    assert.match(carbonMarkup, /data-value="0\.0584">0\.0584/);
    assert.match(carbonMarkup, /0\.584 kgCO2e\/kWh/);
    const facts = plan.result.tool_results.get_financial_analysis.data;
    assert.equal(facts?.cash_balance, 2000);
    assert.equal(facts?.annual_cash_available_for_debt_service, null);
    assert.equal(facts?.origin, 'SERVICE');
    const markup = renderToStaticMarkup(<AgentResultPanel run={plan} />);
    assert.match(markup, /LangGraph MainAgent/);
    assert.match(markup, /SERVICE_UNAVAILABLE:transition/);
    assert.match(markup, /TOOL_CALLED/);
    const primary = markup.split('<details')[0];
    assert.match(primary, /Transition options are not yet available/);
    assert.doesNotMatch(primary, /SERVICE_UNAVAILABLE|LangGraph|MainAgent|deterministic|TOOL_CALLED/);
    assert.match(markup, /<details[^>]*><summary>View analysis details<\/summary>/);
    assert.doesNotMatch(markup, /leads your selected actions|Recommended pathway/);
    assert.deepEqual((await getAgent(intake, plan.run_id)).result, plan.result);
    await assert.rejects(resumeAgent(intake, plan, 'ACCEPT', 'Cannot bypass context'), /no recommendation/);

    const financial = await resumeAgent(intake, plan, 'RESUME', 'Review supplied financial snapshot', objective('ASSESS_FINANCIAL'));
    assert.equal(financial.result.status, 'HUMAN_REVIEW_REQUIRED');
    assert.equal(financial.awaiting, 'human_review');
    assert.ok(financial.interrupts.length);
    assert.equal(financial.result.recommendation?.selected_pathway_id, null);
    assert.ok(financial.result.execution_trace.some(event => event.event === 'HUMAN_REVIEW_REQUESTED'));
    assert.match(renderToStaticMarkup(<AgentResultPanel run={financial} />), /HUMAN_REVIEW_REQUIRED/);
    const accepted = await resumeAgent(intake, financial, 'ACCEPT', 'Reviewed supplied snapshot and CFADS limitation');
    assert.equal(accepted.result.status, 'ACCEPTED');
    assert.equal(accepted.result.human_decision?.actor, 'Runtime reviewer');
    assert.match(renderToStaticMarkup(<AgentResultPanel run={accepted} />), /Human decision:/);
    await assert.rejects(resumeAgent(intake, financial, 'REJECT', 'Stale decision'), /changed/);

    const another = await startAgent(intake, objective('ASSESS_FINANCIAL'));
    assert.equal((await resumeAgent(intake, another, 'REJECT', 'Request better financial evidence')).result.status, 'REJECTED');
    const alternative = await startAgent(intake, objective('ASSESS_FINANCIAL'));
    const context = await resumeAgent(intake, alternative, 'REQUEST_ALTERNATIVE', 'Ask for another analysis');
    assert.equal(context.result.status, 'NEEDS_CONTEXT');
    assert.equal(context.awaiting, 'context');

    let partial = await startIntake([new File([csv], 'partial.csv')], 'Partial reviewer',
      ['financial_analysis'], { quality: 'UNKNOWN', basis: '' });
    const paused = await startAgent(partial, objective('ASSESS_FINANCIAL'));
    assert.equal(paused.result.status, 'NEEDS_CONTEXT');
    assert.deepEqual(paused.result.tool_results, {});
    partial = await resumeIntake(partial, { action: 'continue_incomplete', reason: 'Explicitly accept undeclared source quality' });
    const resumed = await resumeAgent(partial, paused, 'RESUME', 'Intake evidence decision completed');
    assert.equal(resumed.result.status, 'HUMAN_REVIEW_REQUIRED');
    assert.equal(resumed.result.readiness.financial_analysis.status, 'PARTIAL');
    assert.match(renderToStaticMarkup(<AgentResultPanel run={resumed} />), /PARTIAL explicitly accepted/);

    const blocked = await startIntake([new File(['revenue\n-1'], 'invalid.csv')], 'Blocked reviewer',
      ['financial_analysis'], { quality: 'UNKNOWN', basis: '' });
    const denied = await startAgent(blocked, objective('ASSESS_FINANCIAL'));
    assert.equal(denied.result.status, 'NEEDS_CONTEXT');
    assert.deepEqual(denied.result.tool_results, {});
    assert.ok(Object.values(denied.service_status).every(status => status === 'NOT_CALLED'));
    console.log('Live runtime: Phase 1 checkpoint → MainAgent → authoritative CarbonResult and rendered Carbon Analysis values. Financial snapshot → real LangGraph human interrupt → ACCEPT/REJECT. Transition remains explicitly unavailable. PARTIAL resume and BLOCKED gating verified. No fixture services installed.');
  } finally {
    globalThis.fetch = nativeFetch;
    if (child.exitCode === null) {
      const stopped = once(child, 'exit');
      child.kill();
      await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 3000))]);
    }
  }
});
