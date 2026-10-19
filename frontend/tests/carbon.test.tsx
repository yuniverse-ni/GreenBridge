import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CarbonResultPanel } from '../src/components/CarbonAccountingView';
import { OverviewSummary } from '../src/components/OverviewView';
import { getCarbon } from '../src/services/carbon';
import { Objective, startAgent } from '../src/services/agent';
import { resumeIntake, startIntake } from '../src/services/intake';

const demo = readFileSync(new URL('../../test_data/greenbridge_20_fields.csv', import.meta.url), 'utf8');
const objective: Objective = { mode: 'ASSESS_CARBON', focus: 'CARBON', description: 'Review uploaded Carbon evidence',
  constraints: {}, funding: { mode: 'CASH_ONLY', grant_amount: null, maximum_sme_contribution: null, terms: null }, action_ids: [] };

test('Phase 3B real HTTP: 20-field CSV → Intake → CarbonResult → Carbon UI and MainAgent exact equality', { timeout: 60000 }, async () => {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  const target = `http://127.0.0.1:${port}`;
  const child = spawn(process.env.PYTHON || 'python', ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), windowsHide: true,
    env: { ...process.env, GEMINI_API_KEY: '', GOOGLE_API_KEY: '', GREENBRIDGE_CARBON_SERVICE: '',
      GREENBRIDGE_FINANCIAL_SERVICE: '', GREENBRIDGE_TRANSITION_SERVICE: '' }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let log = ''; let spawnError: Error | undefined;
  child.stderr.on('data', chunk => { log = (log + chunk).slice(-3000); }); child.on('error', error => { spawnError = error; });
  const nativeFetch = globalThis.fetch;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(log);
      try { ready = (await nativeFetch(`${target}/health`)).ok; } catch { /* Startup only. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, log);
    const requests: string[] = [];
    globalThis.fetch = (input, options) => {
      requests.push(String(input));
      return nativeFetch(String(input).replace(/^https?:\/\/[^/]+/, target), options);
    };
    const intake = await startIntake([new File([demo], 'greenbridge_20_fields.csv')], 'Carbon reviewer',
      ['carbon_analysis', 'financial_analysis', 'transition_analysis'], { quality: 'DIRECT_MEASURED', basis: 'Existing canonical regression/demo source' });
    assert.equal(intake.result.agent_next_action, 'PROCEED');
    assert.deepEqual(intake.result.mapping_requests, []);
    assert.equal(intake.result.normalized_data?.activity.electricity_kwh, 100);
    const facts = (await getCarbon(intake)).data!;
    assert.ok(facts);
    assert.equal(facts.scope1_emissions, 0);
    assert.equal(facts.scope2_emissions, .0584);
    assert.equal(facts.total_emissions, .0584);
    assert.equal(facts.carbon_intensity.value, .584);
    assert.equal(facts.emissions_by_source.electricity_kwh.factor, .584);
    assert.equal(facts.emissions_by_source.electricity_kwh.activity_unit, 'kWh');
    assert.deepEqual(facts.provenance.electricity_kwh, intake.result.normalized_data?.provenance.electricity_kwh);
    assert.equal(requests.filter(url => url.endsWith('/api/agent/start')).length, 0);
    const markup = renderToStaticMarkup(<CarbonResultPanel result={facts} />);
    assert.match(markup, /Scope 1 - Direct Emissions/);
    assert.match(markup, /Scope 2 - Purchased Electricity/);
    assert.match(markup, /0\.0584/);
    assert.match(markup, /0\.584/);
    assert.match(markup, /Facility area intensity/);
    assert.match(markup, /Reporting year 2024/);
    assert.match(markup, /not independently verified/);
    assert.match(markup, /Suruhanjaya Tenaga Grid Emission Factor 2023/);
    assert.doesNotMatch(markup, /GHG Protocol Aligned|Data confidence: 100%|Default User Factor/);
    assert.match(renderToStaticMarkup(<OverviewSummary result={null} carbon={facts} />), /0\.0584 tCO₂e/);
    const run = await startAgent(intake, objective);
    assert.equal(run.service_status.get_carbon_analysis, 'AVAILABLE');
    assert.equal(run.awaiting, 'human_review');
    assert.deepEqual(run.result.tool_results.get_carbon_analysis.data, facts);
    assert.ok(run.result.execution_trace.some(item => item.tool === 'get_carbon_analysis' && item.event === 'TOOL_CALLED'));
    assert.ok(!run.result.missing_context.some(text => text.includes('SERVICE_UNAVAILABLE:carbon')));

    // Render deliberately distinct backend facts unchanged: no frontend carbon arithmetic.
    const display = renderToStaticMarkup(<CarbonResultPanel result={{ ...facts, scope1_emissions: 12.3456,
      scope2_emissions: 34.5678, total_emissions: 46.9134, carbon_intensity: { ...facts.carbon_intensity, value: 469.134 } }} />);
    assert.match(display, /12\.3456/); assert.match(display, /34\.5678/);
    assert.match(display, /46\.9134/); assert.match(display, /469\.134/);

    let partial = await startIntake([new File(['company_id,reporting_year,reporting_period,electricity_kwh\nPARTIAL,2024,2024,100'], 'electricity.csv')],
      'Carbon reviewer', ['carbon_analysis'], { quality: 'DIRECT_MEASURED', basis: 'Annual electricity export' });
    assert.equal((await getCarbon(partial)).data, null);
    partial = await resumeIntake(partial, { action: 'continue_incomplete', reason: 'Explicitly accept missing fuel applicability' });
    const partialFacts = (await getCarbon(partial)).data!;
    assert.equal(partialFacts.scope1_emissions, null);
    assert.equal(partialFacts.scope2_emissions, .0584);
    assert.equal(partialFacts.total_emissions, null);
    assert.equal(partialFacts.carbon_intensity.value, null);
    assert.match(renderToStaticMarkup(<CarbonResultPanel result={partialFacts} />), /incomplete baseline/);
    assert.match(renderToStaticMarkup(<CarbonResultPanel result={partialFacts} />), /Not available/);
    assert.deepEqual((await startAgent(partial, objective)).result.tool_results.get_carbon_analysis.data, partialFacts);
    await assert.rejects(getCarbon({ ...intake, access_token: 'wrong' }), /Intake unavailable/);
    console.log('Phase 3B demo: Scope 1 = 0; Scope 2 = total = 0.0584 tCO2e; floor-area intensity = 0.584 kgCO2e/m2. Carbon UI and MainAgent consume identical backend CarbonResult.');
  } finally {
    globalThis.fetch = nativeFetch;
    if (child.exitCode === null) {
      const stopped = once(child, 'exit'); child.kill();
      await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 3000))]);
    }
  }
});
