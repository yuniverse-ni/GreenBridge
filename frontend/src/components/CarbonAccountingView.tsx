import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, X } from 'lucide-react';
import { useTransition } from '../context/TransitionContext';
import { AgentRun, CarbonResult, isCarbonResult, Objective, startAgent } from '../services/agent';
import { savedIntake } from '../services/intake';

const CARBON_OBJECTIVE: Objective = {
  mode: 'ASSESS_CARBON',
  focus: 'CARBON',
  description: 'Calculate the carbon baseline from the normalized intake activity data.',
  constraints: {},
  funding: { mode: 'CASH_ONLY', grant_amount: null, maximum_sme_contribution: null, terms: null },
  action_ids: [],
};
const number = (value: number | null | undefined) => value == null
  ? 'Not available'
  : new Intl.NumberFormat('en-MY', { maximumFractionDigits: 8 }).format(value);

export function CarbonResultPanel({ result }: { result: CarbonResult }) {
  const qualityLabels: Record<string, string> = {
    DIRECT_MEASURED: 'Direct measured',
    INVOICE_DERIVED: 'Invoice-derived',
    ESTIMATED_PROXY: 'Estimated / proxy',
    UNKNOWN: 'Unknown',
  };
  const evidenceQuality = Object.entries(result.data_confidence.evidence_quality_counts)
    .filter(([, count]) => count > 0);

  return <section className="gb-carbon-page" aria-label="Authoritative Carbon Result" aria-live="polite">
    <div className="gb-carbon-kpis">
      <article className="gb-carbon-kpi gb-carbon-kpi-total">
        <h2>{result.activity_data_complete ? 'Total Carbon Footprint' : 'Known Emissions Subtotal'}</h2>
        <div><strong data-value={result.total_tco2e ?? 'unknown'}>{number(result.total_tco2e)}</strong><span>tCO<sub>2</sub>e</span></div>
        <p>Reporting year {result.reporting_year}</p>
        <small>Activity data {result.activity_data_complete ? 'complete' : 'partial'} · MainAgent CarbonResult · {result.origin}</small>
      </article>
      <article className="gb-carbon-kpi">
        <h2>Scope 1 — Direct Emissions</h2>
        <div><strong data-value={result.scope1_emissions_tco2e ?? 'unknown'}>{number(result.scope1_emissions_tco2e)}</strong><span>tCO<sub>2</sub>e</span></div>
        <p>Direct fuel combustion</p>
      </article>
      <article className="gb-carbon-kpi">
        <h2>Scope 2 — Purchased Electricity</h2>
        <div><strong data-value={result.scope2_emissions_tco2e ?? 'unknown'}>{number(result.scope2_emissions_tco2e)}</strong><span>tCO<sub>2</sub>e</span></div>
        <p>Purchased grid electricity</p>
      </article>
    </div>

    <div className="gb-carbon-body">
      <article className="gb-carbon-sources gb-panel" aria-labelledby="carbon-sources-heading">
        <h2 id="carbon-sources-heading">Emissions by Activity Source</h2>
        <ul className="gb-carbon-source-list">{result.emissions_by_source.map(source => (
          <li key={source.source}>
            <div>
              <strong>{source.source}</strong>
              <span>{number(source.emissions_tco2e)} tCO<sub>2</sub>e
                {source.share_pct == null ? null : <small> {number(source.share_pct)}%</small>}
              </span>
            </div>
            <p>
              Activity: {number(source.activity_value)} {source.activity_unit}
              {' · '}Factor: {number(source.factor_kgco2e_per_unit)} {source.factor_unit ?? ''}
              {source.factor_source ? ` · ${source.factor_source} ${source.factor_version ?? ''}` : ''}
            </p>
          </li>
        ))}</ul>
      </article>

      <article className="gb-carbon-quality gb-panel" aria-labelledby="carbon-quality-heading">
        <h2 id="carbon-quality-heading">Data &amp; Evidence Confidence</h2>
        <dl>
          <div><dt>Supported activity sources</dt><dd>{result.data_confidence.activity_source_count}</dd></div>
          <div><dt>Sources with evidence</dt><dd>{result.data_confidence.evidenced_source_count}</dd></div>
          <div><dt>Evidence records</dt><dd>{result.data_confidence.evidence_record_count}</dd></div>
        </dl>
        {evidenceQuality.length > 0 && <ul>{evidenceQuality.map(([quality, count]) => (
          <li key={quality}>{qualityLabels[quality] ?? quality}: {count}</li>
        ))}</ul>}
      </article>

      <article className="gb-carbon-intensity gb-panel" aria-labelledby="carbon-intensity-heading">
        <h2 id="carbon-intensity-heading">Carbon Intensity</h2>
        {result.carbon_intensity
          ? <dl><div><dt>Floor-area intensity<small>kgCO<sub>2</sub>e / m²</small></dt>
            <dd data-value={result.carbon_intensity.value}>{number(result.carbon_intensity.value)}</dd></div>
            <div><dt>Floor area denominator</dt><dd>{number(result.carbon_intensity.floor_area_m2)} m²</dd></div></dl>
          : <p>Not available — a complete activity set and positive floor-area denominator are required.</p>}
      </article>
    </div>

    {(result.missing_data.length > 0 || result.warnings.length > 0) && <section className="gb-panel" aria-label="Carbon data limitations">
      <h2>Missing data &amp; warnings</h2>
      {[...result.missing_data, ...result.warnings].map((message, index) => <p key={`${index}-${message}`}>{message}</p>)}
    </section>}
    <details className="gb-panel">
      <summary>Methodology, factor provenance &amp; evidence</summary>
      <p>Emissions are calculated by the backend as normalized activity multiplied by its documented emission factor. Scope classification is explicit: direct fuels are Scope 1; purchased electricity is Scope 2. Missing activity is unknown, not zero.</p>
      <div className="gb-table-scroll"><table><thead><tr>
        <th>Source</th><th>Scope</th><th>Factor</th><th>Source / version</th><th>Region</th>
      </tr></thead><tbody>{result.factor_provenance.map((factor, index) => <tr key={`${factor.source}-${index}`}>
        <td>{factor.source}</td><td>{factor.scope}</td>
        <td>{number(factor.factor_kgco2e_per_unit)} {factor.factor_unit}</td>
        <td>{factor.factor_source} / {factor.factor_version}</td><td>{factor.factor_region ?? 'Not specified'}</td>
      </tr>)}</tbody></table></div>
      {result.emissions_by_source.map(source => source.evidence.map((evidence, index) => (
        <p key={`${source.source}-${index}`}>
          {source.source}: {evidence.source_file}, row {evidence.row}
          {evidence.reporting_period ? `, period ${evidence.reporting_period}` : ''}
          {` · ${evidence.evidence_quality} · ${evidence.confirmation_status}`}
          {evidence.evidence_quality_basis ? ` · ${evidence.evidence_quality_basis}` : ''}
        </p>
      )))}
    </details>
  </section>;
}

export const CarbonAccountingView: React.FC = () => {
  const { setActiveTab } = useTransition();
  const [result, setResult] = useState<CarbonResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasIntake, setHasIntake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);
  const methodologyRef = useRef<HTMLDialogElement>(null);
  const initialLoadStarted = useRef(false);

  const refreshCarbonResult = useCallback(async () => {
    const intake = savedIntake();
    setHasIntake(!!intake);
    if (!intake) {
      setResult(null);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const run: AgentRun = await startAgent(intake, CARBON_OBJECTIVE);
      const carbon = run.result.tool_results.get_carbon_analysis?.data;
      if (!isCarbonResult(carbon)) {
        const missing = run.result.tool_results.get_carbon_analysis?.missing_context ?? [];
        throw new Error(missing.join(' ') || 'MainAgent did not return a valid CarbonResult.');
      }
      setResult(carbon);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Carbon analysis failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const dialog = methodologyRef.current;
    if (showMethodology && dialog && !dialog.open) dialog.showModal();
    else if (!showMethodology && dialog?.open) dialog.close();
  }, [showMethodology]);

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void refreshCarbonResult();
  }, [refreshCarbonResult]);

  return (
    <section className="gb-carbon-page" aria-labelledby="carbon-heading">
      <div className="gb-page-heading gb-carbon-heading">
        <div className="gb-carbon-title"><h1 id="carbon-heading">Carbon Analysis</h1><span className="gb-status">Authoritative backend result</span></div>
        <button className="gb-button" disabled={busy} onClick={() => void refreshCarbonResult()}>
          <RefreshCw size={15} /> {busy ? 'Calculating…' : 'Refresh carbon analysis'}
        </button>
      </div>
      {busy && <p role="status">Running MainAgent Carbon analysis from the published Data Intake result…</p>}
      {error && <p role="alert" className="gb-carbon-empty">{error}</p>}
      {!hasIntake && !busy && <p className="gb-carbon-empty">Complete Data &amp; Documents first, then refresh to calculate from its published activity data.</p>}
      {result && <CarbonResultPanel result={result} />}
      <div className="gb-carbon-next">
        <button className="gb-text-button" aria-haspopup="dialog" onClick={() => setShowMethodology(true)}>View methodology &amp; emission factors</button>
        <button className="gb-button gb-primary" onClick={() => setActiveTab('actions')}>Explore Transition Actions <ArrowRight size={15} /></button>
      </div>
      <dialog ref={methodologyRef} className="gb-action-dialog gb-carbon-methodology" aria-labelledby="methodology-heading"
        onCancel={() => setShowMethodology(false)} onClose={() => setShowMethodology(false)}>
        <div className="gb-action-dialog-heading"><h2 id="methodology-heading">Carbon methodology</h2>
          <button className="gb-button" aria-label="Close methodology" onClick={() => setShowMethodology(false)}><X size={16} /></button></div>
        <p>The values shown on this page are the CarbonResult returned by MainAgent’s deterministic backend Carbon service. This view formats and displays that result; it does not calculate emissions or select factors.</p>
        {result && <CarbonResultPanel result={result} />}
      </dialog>
    </section>
  );
};
