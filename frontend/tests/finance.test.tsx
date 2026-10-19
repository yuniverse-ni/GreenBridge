import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FinanceResultPanel } from '../src/components/FinancialAnalysisView';
import { OverviewSummary } from '../src/components/OverviewView';
import { continueToOverview } from '../src/components/DataIngestionView';
import { FinanceResult, getFinance } from '../src/services/finance';
import { Objective, startAgent } from '../src/services/agent';
import { resumeIntake, startIntake } from '../src/services/intake';
import { TransitionTab } from '../src/types/transition';

const headers = 'company_id,reporting_year,reporting_period,revenue,cogs,operating_expenses,cash_balance,operating_cash_flow,annual_debt_service,total_debt,current_liabilities,capex_budget,minimum_cash_reserve';
const csv = `${headers}\nFINANCE_TEST,2024,2024,100000,40000,30000,20000,18000,6000,45000,10000,12000,5000`;
const objective: Objective = { mode: 'ASSESS_FINANCIAL', focus: 'BALANCED', description: 'Review supplied financial information',
  constraints: {}, funding: { mode: 'CASH_ONLY', grant_amount: null, maximum_sme_contribution: null, terms: null }, action_ids: [] };

test('real HTTP: intake → FinanceResult → Financial Analysis and MainAgent share facts, gating and provenance', { timeout: 60000 }, async () => {
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
  const requests: string[] = [];
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
    globalThis.fetch = (input, options) => {
      requests.push(String(input));
      return nativeFetch(String(input).replace(/^https?:\/\/[^/]+/, target), options);
    };
    const upload = (content: string, quality: 'UNKNOWN' | 'DIRECT_MEASURED' = 'DIRECT_MEASURED') => startIntake(
      [new File([content], 'finance.csv')], 'Finance reviewer', ['financial_analysis'],
      { quality, basis: quality === 'UNKNOWN' ? '' : 'Supplied annual export' });
    const intake = await upload(csv);
    assert.equal(intake.result.agent_next_action, 'PROCEED');
    assert.deepEqual(intake.result.mapping_requests, []);
    const response = await getFinance(intake);
    const facts = response.data!;
    assert.ok(facts);
    assert.deepEqual(facts.inputs, intake.result.normalized_data?.financial);
    assert.equal(facts.gross_profit, 60000);
    assert.equal(facts.ebitda, 30000);
    assert.equal(facts.metrics.ebitda_debt_service_coverage.value, 5);
    assert.equal(facts.inputs.operating_cash_flow, 18000);
    assert.equal(facts.annual_cash_available_for_debt_service, null);
    assert.deepEqual(facts.financial_provenance.cogs, intake.result.normalized_data?.provenance.cogs);
    assert.ok(facts.evidence.some(item => item.field === 'total_debt' && item.normalized_value === 45000));
    let page: TransitionTab = 'ingestion';
    const navigate = (next: TransitionTab) => { page = next; };
    continueToOverview(intake.result, navigate);
    assert.equal(page, 'overview');
    const overview = renderToStaticMarkup(<OverviewSummary result={facts} onNavigate={navigate} />);
    assert.match(overview, /100,000\.00/);
    assert.match(overview, /30,000\.00/);
    assert.match(overview, /20,000\.00/);
    assert.match(overview, /5\.00x/);
    assert.match(overview, /Carbon analysis not available yet\./);
    assert.doesNotMatch(overview, /SERVICE_UNAVAILABLE|Current DSCR|Projected Annual Savings|0 tCO2e/);
    const summaryTree = OverviewSummary({ result: facts, onNavigate: navigate });
    // Invoke the actual summary navigation button, without a mocked API result.
    function reviewFinancial(node: React.ReactNode): boolean {
      if (!React.isValidElement(node)) return false;
      const props = node.props as { children?: React.ReactNode; onClick?: () => void };
      if (node.type === 'button' && renderToStaticMarkup(node).includes('Review financial analysis')) {
        props.onClick?.(); return true;
      }
      return React.Children.toArray(props.children).some(reviewFinancial);
    }
    assert.ok(reviewFinancial(summaryTree));
    assert.equal(page, 'financials');
    const markup = renderToStaticMarkup(<FinanceResultPanel result={facts} />);
    const primary = markup.split('<details')[0];
    assert.match(primary, /Performance/);
    assert.match(primary, /Liquidity &amp; Debt/);
    assert.match(primary, /Transition Capacity/);
    assert.match(primary, /Not available/);
    assert.doesNotMatch(primary, /EBITDA \/ Annual debt service|financial_provenance|operating_cash_flow|screening ratio/);
    assert.match(markup, /<details[^>]*><summary>View details<\/summary>/);
    assert.match(markup, /EBITDA \/ Annual debt service/);
    assert.match(markup, /financial_provenance/);
    assert.equal(requests.filter(url => url.endsWith('/api/agent/start')).length, 0);
    // Opening Copilot does not run it. Submission below explicitly starts it.
    navigate('copilot');
    const run = await startAgent(intake, objective);
    assert.equal(requests.filter(url => url.endsWith('/api/agent/start')).length, 1);
    assert.deepEqual(run.result.tool_results.get_financial_analysis.data, facts);
    assert.equal(run.awaiting, 'human_review');
    assert.ok(run.result.execution_trace.some(event => event.tool === 'get_financial_analysis' && event.event === 'TOOL_CALLED'));
    assert.match(markup, /60,000\.00/);
    assert.match(markup, /30,000\.00/);
    assert.match(markup, /5\.00x/);
    assert.match(markup, /Reported operating cash flow/);
    assert.match(markup, /CFADS-based DSCR/);
    assert.doesNotMatch(markup, /3,200,000|50\.00x|Precision Manufacturing|Verified by Python/);

    const missing = (await getFinance(await upload(`${headers}\nFINANCE_TEST,2024,2024,100000,,30000,20000,,6000,,,12000,5000`))).data!;
    assert.equal(missing.inputs.cogs, null);
    assert.equal(missing.ebitda, null);
    assert.equal(missing.metrics.ebitda_debt_service_coverage.value, null);
    assert.match(renderToStaticMarkup(<FinanceResultPanel result={missing} />), /Not available/);
    assert.match(renderToStaticMarkup(<OverviewSummary result={missing} />), /Not available/);

    const zeros = (await getFinance(await upload(`${headers}\nFINANCE_TEST,2024,2024,0,0,0,0,0,0,0,0,0,0`))).data!;
    assert.equal(zeros.ebitda, 0);
    assert.equal(zeros.inputs.operating_cash_flow, 0);
    assert.equal(zeros.metrics.ebitda_debt_service_coverage.value, null);
    assert.match(renderToStaticMarkup(<FinanceResultPanel result={zeros} />), /0\.00/);

    let partial = await upload(csv, 'UNKNOWN');
    assert.equal((await getFinance(partial)).data, null);
    navigate('ingestion');
    continueToOverview(partial.result, navigate);
    assert.equal(page, 'ingestion');
    partial = await resumeIntake(partial, { action: 'continue_incomplete', reason: 'Explicitly accept source quality limitations' });
    continueToOverview(partial.result, navigate);
    assert.equal(page, 'overview');
    const accepted = (await getFinance(partial)).data!;
    assert.equal(accepted.readiness.status, 'PARTIAL');
    assert.equal(accepted.readiness.partial_accepted, true);
    assert.match(renderToStaticMarkup(<FinanceResultPanel result={accepted} />), /limitations explicitly accepted/);
    assert.match(renderToStaticMarkup(<OverviewSummary result={accepted} />), /accepted limitations/);
    const blocked = await upload(csv.replace('100000,40000', '-1,40000'));
    assert.equal((await getFinance(blocked)).data, null);
    navigate('ingestion');
    continueToOverview(blocked.result, navigate);
    assert.equal(page, 'ingestion');
    await assert.rejects(getFinance({ ...intake, access_token: 'invalid' }), /Intake unavailable/);
    console.log('Flow demo: Upload → Intake → READY/explicit PARTIAL acceptance → Overview → Financial Analysis → intentional AI Copilot request. Same FinanceResult reaches MainAgent; no automatic agent start.');
  } finally {
    globalThis.fetch = nativeFetch;
    child.kill();
  }
});

test('Financial Analysis renders supplied server metrics without recalculating them', () => {
  // Deliberately distinctive presentation data verifies that display consumes the
  // server result instead of deriving another EBITDA/ratio from the inputs.
  const result = { company_id: 'DISPLAY_TEST', reporting_year: 2024, inputs: { revenue: 1000 }, gross_profit: 123,
    ebitda: 456, cash_above_reserve: null, readiness: { status: 'READY', partial_accepted: false },
    metrics: { cash_ratio: { is_calculable: true, formatted: '7.89x', formula: 'Server formula' } }, evidence_limitations: [],
  } as unknown as FinanceResult;
  const markup = renderToStaticMarkup(<FinanceResultPanel result={result} />);
  assert.match(markup, /123\.00/);
  assert.match(markup, /456\.00/);
  assert.match(markup, /7\.89x/);
});
