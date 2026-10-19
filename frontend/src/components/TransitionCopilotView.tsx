import React, { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useTransition } from '../context/TransitionContext';
import { getIntake, IntakeSession, savedIntake } from '../services/intake';
import { AgentAction, AgentRun, getAgent, Objective, rememberRun, resumeAgent, savedRun, startAgent } from '../services/agent';

const number = (value: number | null | undefined) => value == null ? 'Unavailable' : new Intl.NumberFormat('en-MY', { maximumFractionDigits: 2 }).format(value);

/** The graph supplies selection, ranking, permissions and trace. No local ranking. */
export function AgentResultPanel({ run }: { run: AgentRun }) {
  const result = run.result;
  const selected = result.ranked_pathways.find(item => item.pathway.pathway_id === result.recommendation?.selected_pathway_id);
  const productText = (text: string) => !/SERVICE_UNAVAILABLE|LangGraph|Gemini|deterministic|\b(graph|runtime|tool)\b/i.test(text);
  const explanation = result.llm_explanation;
  const carbonRequired = run.service_status.get_carbon_analysis === 'SERVICE_UNAVAILABLE';
  const missingMessage = carbonRequired ? 'Carbon analysis is required before a transition plan can be recommended.'
    : run.service_status.get_financial_analysis === 'SERVICE_UNAVAILABLE' ? 'Financial analysis is required before your options can be assessed.'
    : run.service_status.get_transition_options === 'SERVICE_UNAVAILABLE' ? 'Transition options are not yet available for your business. Please complete the required analysis before trying again.'
    : 'Please review your business data and constraints before continuing.';
  const statusLabel = result.status === 'ACCEPTED' ? 'Accepted' : result.status === 'REJECTED' ? 'Rejected' : result.status === 'CANCELLED' ? 'Cancelled'
    : run.awaiting === 'human_review' ? 'Ready for your review' : 'More information needed';
  const risks = [...(explanation?.risks ?? []), ...(explanation?.missing_data ?? [])].filter(productText);
  return <div className="gb-copilot-result" aria-label="Analysis result" aria-live="polite">
    <div className="gb-copilot-result-title"><span className="gb-copilot-eyebrow">{selected ? 'RECOMMENDED TRANSITION PLAN' : result.recommendation ? 'YOUR BUSINESS REVIEW' : 'YOUR OPTIONS'}</span><span className="gb-copilot-state">{statusLabel}</span></div>
    <h2>{selected?.pathway.name ?? (result.recommendation ? result.objective.mode === 'ASSESS_CARBON' ? 'Carbon assessment' : 'Financial review' : 'Complete your analysis')}</h2>
    {!result.recommendation && <p className="gb-copilot-notice" role="status">{missingMessage}</p>}
    {selected && <dl className="gb-copilot-metrics">
      <div><dt>Projected carbon reduction</dt><dd>{number(selected.pathway.annual_emissions_reduction_tco2e)}<small>tCO2e / year</small></dd></div>
      <div><dt>CAPEX (MYR)</dt><dd>{number(selected.pathway.capex)}</dd></div>
      <div><dt>Annual savings (MYR)</dt><dd>{number(selected.pathway.annual_savings)}</dd></div>
      <div><dt>Payback (years)</dt><dd>{number(selected.pathway.simple_payback_years)}</dd></div>
      {selected.pathway.financing_principal != null && <div><dt>Financing required (MYR)</dt><dd>{number(selected.pathway.financing_principal)}</dd></div>}
      {selected.financing && <div><dt>Annual debt payment (MYR)</dt><dd>{number(selected.financing.annual_debt_service)}</dd></div>}
      {selected.financing?.post_financing_dscr != null && <div><dt>DSCR after financing</dt><dd>{number(selected.financing.post_financing_dscr)}<small>times annual debt payments</small></dd></div>}
      {selected.pathway.remaining_cash != null && <div><dt>Cash after investment (MYR)</dt><dd>{number(selected.pathway.remaining_cash)}</dd></div>}
    </dl>}
    {result.recommendation && <section className="gb-copilot-explanation"><h3>{selected ? 'Why this plan' : 'Your assessment'}</h3>
      <p>{explanation?.summary && productText(explanation.summary) ? explanation.summary
        : selected ? 'Review the projected benefits, investment and supporting evidence before making your choice.'
        : 'Your supplied financial information is available for review. Additional information may be needed to assess transition investments.'}</p>
      {explanation?.trade_offs.filter(productText).slice(0, 2).map((text, i) => <p key={i}>{text}</p>)}
    </section>}
    {(risks.length > 0 || result.warnings.length > 0 || result.missing_context.length > 0 || result.errors.length > 0) && result.recommendation && <section className="gb-copilot-considerations"><h3>Risks &amp; missing information</h3>
      <ul>{risks.slice(0, 3).map((text, i) => <li key={i}>{text}</li>)}
        {Object.values(result.readiness).some(ready => ready.partial_accepted) && <li>Some supporting information is incomplete. Review the recorded limitations before proceeding.</li>}
        {risks.length === 0 && <li>Review the assumptions and outstanding checks in the analysis details before making a decision.</li>}
      </ul></section>}
    {result.human_decision && <p className="gb-copilot-decision">Your decision: <strong>{result.human_decision.action === 'ACCEPT' ? 'Accepted' : 'Rejected'}</strong> — {result.human_decision.reason}</p>}
    <details className="gb-copilot-analysis-details"><summary>View analysis details</summary><div className="gb-copilot-detail-content">
    <p><strong>{result.status}</strong> · LangGraph MainAgent · {result.company_id ?? 'Company context missing'} / {result.reporting_year ?? 'Year missing'}</p>
    {result.recommendation && <section><h3>Recommendation record</h3><p>{result.recommendation.summary}</p><ul>{result.recommendation.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></section>}
    <h3>Services called by the graph</h3><ul>{Object.entries(run.service_status).map(([name, status]) => <li key={name}>{name}: <strong>{status}</strong></li>)}</ul>
    <details><summary>Intake readiness</summary><ul>{Object.entries(result.readiness).map(([name, ready]) => <li key={name}>
      {name}: {ready.status} · {ready.may_proceed ? 'permitted' : 'not permitted'}{ready.partial_accepted ? ' (PARTIAL explicitly accepted)' : ''}
    </li>)}</ul></details>
    {result.missing_context.length > 0 && <div role="status"><h3>Required context / unavailable services</h3><ul>{result.missing_context.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
    {result.llm_explanation && <section><h3>Explanation</h3><p>{result.llm_explanation.summary}</p><ul>
      {[...result.llm_explanation.trade_offs, ...result.llm_explanation.risks, ...result.llm_explanation.missing_data].map((text, i) => <li key={i}>{text}</li>)}
    </ul></section>}
    {[...result.warnings, ...result.errors].map((text, i) => <p key={i}>{text}</p>)}
    {Object.entries(result.tool_results).map(([tool, value]) => value.data && <details key={tool}><summary>{tool} — authoritative service facts</summary>
      <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(value.data, null, 2)}</pre></details>)}
    {result.ranked_pathways.length > 0 && <details><summary>Pathway ranking</summary><div className="gb-table-scroll"><table>
      <thead><tr><th>Rank</th><th>Pathway</th><th>Feasible</th><th>Constraints</th></tr></thead><tbody>
        {result.ranked_pathways.map(item => <tr key={item.pathway.pathway_id}><td>{item.rank}</td><td>{item.pathway.name}</td><td>{String(item.feasible)}</td><td>
          {item.constraints.checks.map(check => <p key={check.name}>{check.name}: {check.status} — {check.reason}</p>)}
        </td></tr>)}
      </tbody></table></div></details>}
    {result.human_decision && <p>Human decision: <strong>{result.human_decision.action}</strong> — {result.human_decision.actor}: {result.human_decision.reason}</p>}
    <details><summary>Execution trace ({result.execution_trace.length} events)</summary><ol>
      {result.execution_trace.slice(-40).map((event, i) => <li key={i}><strong>{event.event}</strong>{event.tool ? ` · ${event.tool}` : ''} — {event.detail}</li>)}
    </ol></details>
    <a className="gb-button" download={`agent-${run.run_id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(run, null, 2))}`}>Download analysis record</a>
    </div></details>
    {selected && <p className="gb-copilot-footnote">Projections are subject to the stated assumptions. Accepting a plan does not approve a loan or authorise sharing.</p>}
  </div>;
}

const CONSTRAINTS: Record<string, string> = {
  carbon_reduction_target_pct: 'Carbon target (%)', minimum_cash_reserve: 'Minimum cash reserve (MYR)',
  maximum_payback_years: 'Maximum payback (years)', maximum_capex: 'Maximum CAPEX (MYR)',
  minimum_post_financing_dscr: 'Minimum company DSCR', maximum_annual_financing_payment: 'Maximum annual debt payment (MYR)',
};

export const TransitionCopilotView: React.FC = () => {
  const { setActiveTab } = useTransition();
  const [intake, setIntake] = useState<IntakeSession | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<Objective['mode']>('PLAN_TRANSITION');
  const [focus, setFocus] = useState<Objective['focus']>('BALANCED');
  const [description, setDescription] = useState('');
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [funding, setFunding] = useState<'CASH_ONLY' | 'FINANCE_IF_NEEDED'>('CASH_ONLY');
  const [grant, setGrant] = useState('');
  const [contribution, setContribution] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');

  function accept(next: AgentRun) {
    setRun(next); rememberRun(next); setReason('');
    const source = next.result.objective;
    setMode(source.mode); setFocus(source.focus); setDescription(source.description);
    setLimits(Object.fromEntries(Object.entries(source.constraints).map(([key, value]) => [key, value == null ? '' : String(value)])));
    setFunding(source.funding.mode);
    setGrant(source.funding.grant_amount == null ? '' : String(source.funding.grant_amount));
    setContribution(source.funding.maximum_sme_contribution == null ? '' : String(source.funding.maximum_sme_contribution));
    setRate(source.funding.terms == null ? '' : String(source.funding.terms.annual_interest_rate_pct));
    setTenure(source.funding.terms == null ? '' : String(source.funding.terms.tenure_years));
  }
  async function load() {
    const reference = savedIntake();
    if (!reference) { setIntake(null); setRun(null); return; }
    const current = await getIntake(reference);
    setIntake(current);
    const id = savedRun(current.intake_id);
    if (id) accept(await getAgent(current, id));
    else setRun(null);
  }
  useEffect(() => {
    let active = true;
    const reference = savedIntake();
    if (!reference) return;
    setBusy(true);
    getIntake(reference).then(async current => {
      const id = savedRun(current.intake_id);
      const restored = id ? await getAgent(current, id) : null;
      if (active) { setIntake(current); if (restored) accept(restored); }
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (error) { setError(error instanceof Error ? error.message : 'Agent request failed.'); }
    finally { setBusy(false); }
  }
  function objective(): Objective {
    const optional = (text: string) => text.trim() === '' ? null : Number(text);
    return { mode, focus, description, constraints: Object.fromEntries(Object.keys(CONSTRAINTS).map(key => [key, optional(limits[key] ?? '')])),
      funding: { mode: funding, grant_amount: optional(grant), maximum_sme_contribution: optional(contribution),
        terms: rate.trim() && tenure.trim() ? { annual_interest_rate_pct: Number(rate), tenure_years: Number(tenure) } : null }, action_ids: [] };
  }
  function decide(action: AgentAction, withObjective = false) {
    if (!run || !intake) return;
    void perform(async () => { accept(await resumeAgent(intake, run, action, reason, withObjective ? objective() : undefined)); });
  }
  return <section className="gb-copilot-product" aria-label="AI Copilot">
    <div className="gb-page-heading"><div><h1>AI Copilot</h1><p>Explore a transition plan that fits your business goals and financial position.</p></div>
      <button className="gb-text-button" onClick={() => setActiveTab('ingestion')}>Data &amp; Documents <ArrowRight size={14} /></button></div>
    <div className={`gb-copilot-workspace ${run ? 'has-analysis' : ''}`}>
    <article className="gb-panel gb-copilot-objective" aria-labelledby="objective-heading">
      <h2 id="objective-heading">What would you like to achieve?</h2>
      <form onSubmit={event => { event.preventDefault(); if (intake) void perform(async () => accept(await startAgent(intake, objective()))); }}>
        <fieldset disabled={busy}>
          <label className="gb-copilot-label" htmlFor="copilot-objective">Your objective</label>
          <textarea id="copilot-objective" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="For example, reduce energy costs while keeping enough cash for day-to-day operations." />
          <label className="gb-copilot-label" htmlFor="copilot-focus">Focus</label>
          <select id="copilot-focus" value={focus} onChange={e => setFocus(e.target.value as Objective['focus'])}>
            <option value="BALANCED">Balanced</option><option value="CARBON">Carbon reduction</option><option value="COST">Financial resilience</option></select>
          <details className="gb-copilot-constraints"><summary>Set constraints <span>Optional</span></summary>
            <p>Add specific limits here when they should guide your assessment. Leave unknown values blank.</p>
            <label className="block">Assessment <select value={mode} onChange={e => setMode(e.target.value as Objective['mode'])}>
              <option value="PLAN_TRANSITION">Transition plan</option><option value="ASSESS_CARBON">Carbon assessment</option><option value="ASSESS_FINANCIAL">Financial review</option></select></label>
            {Object.entries(CONSTRAINTS).map(([key, text]) => <label className="block" key={key}>{text}<input type="number" min="0" max={key === 'carbon_reduction_target_pct' ? 100 : undefined} step="any"
              className="border rounded p-2 w-full" value={limits[key] ?? ''} onChange={e => setLimits(previous => ({ ...previous, [key]: e.target.value }))} /></label>)}
            <label className="block">Funding mode <select value={funding} onChange={e => setFunding(e.target.value as typeof funding)}><option value="CASH_ONLY">Cash only</option><option value="FINANCE_IF_NEEDED">Finance if needed</option></select></label>
            <label className="block">Confirmed grant (MYR; enter 0 only if confirmed)<input className="border rounded p-2 w-full" type="number" min="0" step="any" value={grant} onChange={e => setGrant(e.target.value)} /></label>
            <label className="block">Maximum SME contribution (MYR)<input className="border rounded p-2 w-full" type="number" min="0" step="any" value={contribution} onChange={e => setContribution(e.target.value)} /></label>
            <label className="block">Annual interest rate (%)<input className="border rounded p-2 w-full" type="number" min="0" step="any" value={rate} onChange={e => setRate(e.target.value)} /></label>
            <label className="block">Tenure (years)<input className="border rounded p-2 w-full" type="number" min="1" max="50" step="1" value={tenure} onChange={e => setTenure(e.target.value)} /></label>
          </details>
          <button className="gb-button gb-primary gb-copilot-analyse" type="submit" disabled={!intake}>Analyse my options <ArrowRight size={14} /></button>
        </fieldset>
      </form>
      {!intake && !busy && <p className="gb-copilot-notice">Add your business data in Data &amp; Documents to explore your options.</p>}
      <details className="gb-copilot-analysis-details"><summary>Analysis options</summary>
        <button className="gb-text-button" disabled={busy} onClick={() => void perform(load)}>Refresh analysis</button>
        {error && <p>{error}</p>}
      </details>
    </article>
    <article className="gb-panel gb-copilot-recommendation" aria-label="Your recommendation">
      {error && <p role="alert" className="gb-copilot-notice">We couldn’t complete your request. Review your information and try again. Further information is available in Analysis options.</p>}
      {busy && <p role="status" className="gb-copilot-progress"><RefreshCw size={16} className="inline animate-spin" /> Analysing your options…</p>}
      {run ? <AgentResultPanel run={run} /> : <div className="gb-copilot-empty"><span className="gb-copilot-eyebrow">YOUR TRANSITION PLAN</span><h2>A clearer view of your options</h2>
        <p>Tell us your objective to review projected carbon reduction, investment, savings and financing considerations in one place.</p></div>}
      {run?.result.status === 'ACCEPTED' && <button className="gb-button" onClick={() => setActiveTab('transition-plan')}>Continue to Lender Pack <ArrowRight size={14} /></button>}
      {run?.awaiting && <section className="gb-copilot-review"><h3>{run.awaiting === 'human_review' ? 'Review your plan' : 'Complete the next step'}</h3>
        <label className="gb-copilot-label" htmlFor="copilot-decision">Add a note to record your decision</label>
        <textarea id="copilot-decision" rows={2} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} />
        <div className="gb-header-actions">
          {run.awaiting === 'human_review' ? <>
            <button className="gb-button gb-primary" disabled={busy || !reason.trim()} onClick={() => decide('ACCEPT')}>{run.result.objective.mode === 'PLAN_TRANSITION' ? 'Accept plan' : 'Accept review'}</button>
            <button className="gb-button" disabled={busy || !reason.trim()} onClick={() => decide('REQUEST_ALTERNATIVE')}>Show another option</button>
            <button className="gb-text-button gb-copilot-reject" disabled={busy || !reason.trim()} onClick={() => decide('REJECT')}>Reject</button>
          </> : <>
            <button className="gb-button gb-primary" disabled={busy || !reason.trim()} onClick={() => decide('RESUME')}>Reassess updated data</button>
            <button className="gb-button" disabled={busy || !reason.trim()} onClick={() => decide('RESUME', true)}>Apply these constraints</button>
            <button className="gb-button" disabled={busy || !reason.trim()} onClick={() => decide('CANCEL')}>Cancel</button>
          </>}
        </div>
      </section>}
    </article>
    </div>
  </section>;
};
