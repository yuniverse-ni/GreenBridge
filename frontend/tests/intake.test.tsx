import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntakeResultPanel, readinessIssues } from '../src/components/DataIngestionView';
import { getIntake, intakeMayProceed, resumeIntake, startIntake } from '../src/services/intake';
import { intakeTechnicalSummary } from '../src/utils/intakePresentation';

// Run the actual Python app on an isolated port, then exercise the same API
// client and result component used by Data & Documents. No provider credentials.
test('original upload → real DataIntakeAgent → normalized/readiness result → React display', { timeout: 60000 }, async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  const target = `http://127.0.0.1:${port}`;
  const child = spawn(process.env.PYTHON || 'python', ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), windowsHide: true,
    env: { ...process.env, GEMINI_API_KEY: '', GOOGLE_API_KEY: '' }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverLog = '';
  let spawnError: Error | undefined;
  child.stderr.on('data', chunk => { serverLog = (serverLog + chunk).slice(-3000); });
  child.on('error', error => { spawnError = error; });
  const nativeFetch = globalThis.fetch;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(`Python backend exited: ${serverLog}`);
      try { ready = (await nativeFetch(`${target}/health`)).ok; } catch { /* Wait for server startup. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Python backend failed to start: ${serverLog}`);
    // Only redirect the configured origin to this test's isolated live server.
    globalThis.fetch = (input, options) => nativeFetch(String(input).replace(/^https?:\/\/[^/]+/, target), options);
    const rows = ['metric,value,unit,period', 'company_id,PHASE1,,2024', 'reporting_year,2024,,2024'];
    for (const [field, value] of Object.entries({ revenue: 10000, operating_expenses: 7000, cash_balance: 2000,
      annual_debt_service: 500, capex_budget: 1000, minimum_cash_reserve: 500 })) rows.push(`${field},${value},RM,2024`);
    for (let month = 1; month <= 12; month++) {
      for (const [field, value, unit] of [['electricity_kwh', 1000, 'kWh'], ['diesel_litres', 1, 'litres'],
        ['petrol_litres', 0, 'litres'], ['natural_gas_m3', 0, 'm3'], ['lpg_kg', 0, 'kg']]) {
        rows.push(`${field},${value},${unit},2024-${String(month).padStart(2, '0')}`);
      }
    }
    const original = new File([rows.join('\n')], 'complete.csv', { type: 'text/csv' });
    const declaration = { quality: 'DIRECT_MEASURED' as const, basis: 'Meter and accounting source export' };
    const session = await startIntake([original], 'Integration Reviewer', ['carbon_analysis', 'financial_analysis', 'transition_analysis'], declaration);
    assert.equal(session.result.evidence.length, 68);
    assert.equal(session.files[0].size, original.size);
    assert.equal(session.result.normalized_data?.activity.electricity_kwh, 12000);
    assert.ok(intakeMayProceed(session.result));
    assert.deepEqual((await getIntake(session)).result, session.result);
    const markup = renderToStaticMarkup(<IntakeResultPanel session={session} />);
    assert.match(markup, /Data Intake Result/);
    assert.match(markup, /Carbon readiness: READY/);
    assert.match(markup, /Financial readiness: READY/);
    assert.match(markup, /Transition readiness: READY/);
    assert.match(markup, /12000/);
    assert.match(markup, /preview 50 of 68 values/);
    const readyPrimary = markup.split('<details')[0];
    assert.match(readyPrimary, /Your data is ready for analysis\./);
    assert.doesNotMatch(readyPrimary, /Financial readiness|Carbon readiness|Transition readiness|>Review<|complete.csv/);
    assert.match(markup, /<details[^>]*><summary>Technical details<\/summary>/);
    // The last 18 values are retained in the full download, beyond table preview.
    const download = markup.match(/href="data:application\/json;charset=utf-8,([^"]+)"/);
    assert.ok(download);
    assert.equal(JSON.parse(decodeURIComponent(download[1])).evidence.length, 68);
    assert.equal((markup.match(/<td>complete.csv/g) || []).length, 50);

    let partial = await startIntake([new File(['company_id,reporting_year,revenue,cash_balance\nTEST,2024,0,0'], 'partial.csv')],
      'Integration Reviewer', ['financial_analysis'], { quality: 'UNKNOWN', basis: '' });
    assert.equal(partial.awaiting, 'evidence');
    assert.equal(intakeMayProceed(partial.result), false);
    const pendingPrimary = renderToStaticMarkup(<IntakeResultPanel session={partial} />).split('<details')[0];
    assert.match(pendingPrimary, /Some information needs review before analysis\./);
    assert.match(pendingPrimary, />Review<\/button>/);
    assert.match(pendingPrimary, />Continue /);
    assert.doesNotMatch(pendingPrimary, /operating_expenses|MISSING_FINANCIAL|Financial readiness/);
    const nonContinuable = { ...partial, can_continue_incomplete: false };
    assert.match(renderToStaticMarkup(<IntakeResultPanel session={nonContinuable} />).split('<details')[0], /<button[^>]*disabled=""[^>]*>Continue/);
    const grouped = { ...partial, result: { ...partial.result, data_gaps: [
      { gap_type: 'MISSING_PERIOD', affected_field: 'electricity_kwh', severity: 'WARNING', message: 'Field-specific period warning', recommended_action: 'Supply date' },
      { gap_type: 'MISSING_PERIOD', affected_field: 'diesel_litres', severity: 'WARNING', message: 'Another period warning', recommended_action: 'Supply date' },
      { gap_type: 'UNKNOWN_EVIDENCE_QUALITY', affected_field: null, severity: 'WARNING', message: 'Undeclared source', recommended_action: 'Review source' },
    ] } };
    assert.deepEqual(readinessIssues(grouped).map(issue => [issue.title, issue.status]), [['Reporting period', 'Missing'], ['Evidence quality', 'Not declared']]);
    assert.match(renderToStaticMarkup(<IntakeResultPanel session={grouped} />).split('<details')[0], /2 items need.*attention/);
    partial = await resumeIntake(partial, { action: 'continue_incomplete', reason: 'Explicitly review missing statements later' });
    assert.equal(partial.result.normalized_data?.financial.revenue, 0);
    assert.equal(partial.result.normalized_data?.financial.operating_expenses, null);
    assert.equal(partial.result.readiness.financial_analysis.status, 'PARTIAL');
    assert.equal(intakeMayProceed(partial.result), true);
    const partialMarkup = renderToStaticMarkup(<IntakeResultPanel session={partial} />);
    assert.match(partialMarkup, /Missing — not supplied/);
    assert.match(partialMarkup, /Accepted with limitations/);
    assert.doesNotMatch(partialMarkup, /PARTIAL explicitly accepted/);

    // Use all current canonical fields with undeclared source quality and no
    // activity periods to exercise the real repeated readiness warnings.
    const demoRows = readFileSync(new URL('../../test_data/greenbridge_20_fields.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
    const periodColumn = demoRows[0].split(',').indexOf('reporting_period');
    const withoutPeriods = demoRows.map(row => row.split(',').filter((_, index) => index !== periodColumn).join(',')).join('\n');
    let summarySession = await startIntake([new File([withoutPeriods], 'summary.csv')], 'Integration Reviewer',
      ['carbon_analysis', 'financial_analysis', 'transition_analysis'], { quality: 'UNKNOWN', basis: '' });
    summarySession = await resumeIntake(summarySession, { action: 'continue_incomplete', reason: 'Accept period and source-quality limitations for review' });
    const originalSummaryResult = JSON.stringify(summarySession.result);
    const summary = intakeTechnicalSummary(summarySession.result);
    const carbon = summary.modules.find(module => module.module === 'carbon_analysis')!;
    const financial = summary.modules.find(module => module.module === 'financial_analysis')!;
    assert.deepEqual(carbon.groups.find(group => group.title === 'Reporting period')?.messages, ['Missing for 5 activity records.']);
    assert.deepEqual(carbon.groups.find(group => group.title === 'Evidence quality')?.messages, ['Undeclared for 5 carbon fields.']);
    assert.deepEqual(financial.groups.find(group => group.title === 'Evidence quality')?.messages, ['Undeclared for 10 financial fields.']);
    const summaryMarkup = renderToStaticMarkup(<IntakeResultPanel session={summarySession} />);
    const mainTechnical = summaryMarkup.split('<summary>Field-level validation, data &amp; provenance</summary>')[0];
    assert.match(mainTechnical, /Accepted with limitations/);
    assert.match(mainTechnical, /Depends on available Carbon and Finance data/);
    assert.doesNotMatch(mainTechnical, /Evidence gaps|Source quality for|Activity evidence has no reporting period|electricity_kwh|PARTIAL explicitly accepted|Extracted data/);
    assert.equal((mainTechnical.match(/Undeclared for 5 carbon fields/g) || []).length, 1);
    assert.equal((mainTechnical.match(/Undeclared for 10 financial fields/g) || []).length, 1);
    assert.match(summaryMarkup, /Source quality for electricity_kwh/);
    assert.match(summaryMarkup, /Field-level evidence checks/);
    assert.match(summaryMarkup, /<details><summary>Field-level validation, data &amp; provenance<\/summary>/);
    assert.equal(JSON.stringify(summarySession.result), originalSummaryResult);

    const repeated = structuredClone(summarySession.result);
    repeated.data_gaps.push(...repeated.data_gaps);
    assert.deepEqual(intakeTechnicalSummary(repeated).modules, summary.modules);
    repeated.readiness.financial_analysis.reasons.push('Financial evidence failed reconciliation.');
    repeated.errors.push({ stage: 'parse', file_id: 'one', message: 'Invalid calendar date.' },
      { stage: 'parse', file_id: 'one', message: 'Invalid calendar date.' },
      { stage: 'parse', file_id: 'one', message: 'Unsupported currency.' });
    const distinct = intakeTechnicalSummary(repeated);
    assert.deepEqual(distinct.errors, ['parse: Invalid calendar date.', 'parse: Unsupported currency.']);
    assert.ok(distinct.shared.some(group => group.messages.includes('Financial evidence failed reconciliation.')));
    repeated.data_gaps.push(...['electricity_kwh', 'diesel_litres'].map(field => ({
      gap_type: 'UNIT_REVIEW', affected_field: field, severity: 'ERROR', message: 'The input unit needs confirmation.', recommended_action: 'Confirm unit',
    })));
    assert.ok(intakeTechnicalSummary(repeated).shared.some(group => group.messages.includes('ERROR: The input unit needs confirmation. (2 affected fields)')));
    const mixedQuality = structuredClone(summarySession.result);
    const dieselEvidence = mixedQuality.evidence.find(item => item.field === 'diesel_litres')!;
    dieselEvidence.evidence_quality = 'ESTIMATED_PROXY';
    (mixedQuality.normalized_data!.provenance.diesel_litres[0] as { evidence_quality: string }).evidence_quality = 'ESTIMATED_PROXY';
    assert.deepEqual(intakeTechnicalSummary(mixedQuality).modules[0].groups.find(group => group.title === 'Evidence quality')?.messages,
      ['Undeclared for 4 carbon fields.', 'Estimated / proxy evidence for 1 carbon field.']);

    let mapped = await startIntake([new File(['company_id,reporting_year,Total Power Used,period\nTEST,2024,2,2024'], 'mapping.csv')],
      'Integration Reviewer', ['carbon_analysis'], declaration);
    assert.equal(mapped.awaiting, 'mapping');
    mapped = await resumeIntake(mapped, { decisions: [{ request_id: mapped.result.mapping_requests[0].request_id,
      action: 'confirm', mapped_field: 'electricity_kwh', unit: 'MWh' }] });
    mapped = await resumeIntake(mapped, { action: 'continue_incomplete', reason: 'Remaining activity applicability needs review' });
    assert.equal(mapped.result.normalized_data?.activity.electricity_kwh, 2000);
    assert.equal(mapped.result.evidence.find(item => item.field === 'electricity_kwh')?.original_unit, 'MWh');

    const blocked = await startIntake([new File(['revenue\n-1'], 'invalid.csv')], 'Integration Reviewer', ['financial_analysis'], declaration);
    assert.equal(blocked.result.agent_next_action, 'BLOCK');
    assert.equal(blocked.can_continue_incomplete, false);
    assert.equal(intakeMayProceed(blocked.result), false);
    await assert.rejects(resumeIntake(blocked, { action: 'continue_incomplete', reason: 'Attempt bypass' }), /BLOCKED readiness/);
    assert.match(renderToStaticMarkup(<IntakeResultPanel session={blocked} />), /Financial readiness: BLOCKED/);
    const blockedPrimary = renderToStaticMarkup(<IntakeResultPanel session={blocked} />).split('<details')[0];
    assert.match(blockedPrimary, /Some required information must be resolved before analysis\./);
    assert.match(blockedPrimary, />Review<\/button>/);
    assert.doesNotMatch(blockedPrimary, />Continue/);
    console.log('Phase 1 demonstration: 68 source values → DataIntakeAgent → electricity 12000 kWh → READY for all 3 modules → React table (50 preview values), full JSON (68). Mapping and PARTIAL/BLOCKED flows verified.');
  } finally {
    globalThis.fetch = nativeFetch;
    const stopped = once(child, 'exit');
    child.kill();
    if (child.exitCode === null) await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 3000))]);
  }
});
