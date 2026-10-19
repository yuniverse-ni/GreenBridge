import React from 'react';
import { useTransition } from '../context/TransitionContext';
import { CarbonResult, carbonNumber, useCarbonAnalysis } from '../services/carbon';
import { ArrowRight } from 'lucide-react';

const LABELS: Record<string, string> = { electricity_kwh: 'Electricity', diesel_litres: 'Diesel',
  petrol_litres: 'Petrol', natural_gas_m3: 'Natural gas', lpg_kg: 'LPG', floor_area_m2: 'Floor area' };
const QUALITY: Record<string, string> = { DIRECT_MEASURED: 'Measured', INVOICE_DERIVED: 'Invoice-derived',
  ESTIMATED_PROXY: 'Estimated / Proxy', UNKNOWN: 'Not declared' };

/** All numbers, factors, intensity and evidence come from the same backend result as MainAgent. */
export function CarbonResultPanel({ result }: { result: CarbonResult }) {
  return <>
    <div className="gb-carbon-kpis">
      <article className="gb-carbon-kpi gb-carbon-kpi-total"><h2>Total Carbon Footprint</h2>
        <div><strong>{carbonNumber(result.total_emissions)}</strong><span>tCO<sub>2</sub>e</span></div>
        <p>Reporting year {result.reporting_year}</p><small>{result.readiness.status}{result.readiness.partial_accepted && ' · limitations accepted'}</small>
      </article>
      <article className="gb-carbon-kpi"><h2>Scope 1 - Direct Emissions</h2><div><strong>{carbonNumber(result.scope1_emissions)}</strong><span>tCO<sub>2</sub>e</span></div><p>Diesel, petrol, natural gas and LPG</p></article>
      <article className="gb-carbon-kpi"><h2>Scope 2 - Purchased Electricity</h2><div><strong>{carbonNumber(result.scope2_emissions)}</strong><span>tCO<sub>2</sub>e</span></div><p>Purchased grid electricity</p></article>
    </div>
    {result.total_emissions == null && <p role="status">Some activity is missing. Supplied sources account for {carbonNumber(result.known_emissions)} tCO₂e; this is an incomplete baseline.</p>}
    <div className="gb-carbon-body">
      <article className="gb-carbon-sources gb-panel"><h2>Emissions by Activity Category</h2>
        <ul className="gb-carbon-source-list">{Object.entries(result.emissions_by_source).map(([field, source]) => <li key={field}>
          <div><strong>{LABELS[field]}</strong><span>{carbonNumber(source.emissions)}{source.emissions != null && <> tCO<sub>2</sub>e</>}</span></div>
          {source.share_pct != null && <div className="gb-carbon-source-track" aria-hidden="true"><span style={{ width: `${source.share_pct}%` }} /></div>}
        </li>)}</ul>
      </article>
      <article className="gb-carbon-quality gb-panel"><h2>Data Confidence</h2>
        <p>Evidence quality is declared, not independently verified.</p>
        <dl className="gb-facts">{Object.entries(result.confidence.evidence_quality_counts).map(([quality, count]) =>
          <div key={quality}><dt>{QUALITY[quality] || quality}</dt><dd>{count} records</dd></div>)}</dl>
      </article>
      <article className="gb-carbon-intensity gb-panel"><h2>Carbon Intensity</h2>
        <dl><div><dt>Facility area intensity<small>kgCO₂e / m²</small></dt><dd>{carbonNumber(result.carbon_intensity.value)}</dd></div></dl>
        {result.carbon_intensity.value == null && <p>{result.carbon_intensity.reason}</p>}
      </article>
    </div>
    <details className="gb-panel" style={{ padding: 18 }}><summary>View methodology &amp; emission factors</summary>
      <p>Activity × the applicable kgCO₂e factor ÷ 1,000 = tCO₂e. Totals require complete source coverage. No intermediate source rounding is applied.</p>
      <h3>Factor applicability &amp; evidence</h3><ul>{result.warnings.map(text => <li key={text}>{text}</li>)}</ul>
      <h3>Activity and emission factors</h3><div className="gb-table-scroll"><table><thead><tr>
        <th>Activity</th><th>Scope</th><th>Quantity</th><th>Factor</th><th>Source / Version</th>
      </tr></thead><tbody>{Object.entries(result.emissions_by_source).map(([field, source]) => <tr key={field}>
        <td>{LABELS[field]}</td><td>{source.scope}</td><td>{carbonNumber(source.activity_value)} {source.activity_unit}</td>
        <td>{carbonNumber(source.factor)} {source.factor_unit}</td><td>{source.factor_source} / {source.factor_version} / {source.factor_region}</td>
      </tr>)}</tbody></table></div>
      {result.missing_data.length > 0 && <p>Missing data: {result.missing_data.map(field => LABELS[field] || field).join(', ')}</p>}
      <details><summary>Provenance &amp; technical details</summary><pre style={{ maxHeight: 350, overflow: 'auto', fontSize: 11 }}>{JSON.stringify(result, null, 2)}</pre></details>
    </details>
  </>;
}

export const CarbonAccountingView: React.FC = () => {
  const { setActiveTab } = useTransition();
  const { result, message, busy, refresh } = useCarbonAnalysis();
  return <section className="gb-carbon-page" aria-labelledby="carbon-heading" aria-busy={busy}>
    <div className="gb-page-heading gb-carbon-heading"><div className="gb-carbon-title"><h1 id="carbon-heading">Carbon Analysis</h1></div>
      <button className="gb-button" disabled={busy} onClick={refresh}>Refresh analysis</button></div>
    {busy && <p role="status">Loading Carbon analysis…</p>}
    {message && <div className="gb-panel" style={{ padding: 20 }} role="status"><p>{message}</p>
      <button className="gb-button" onClick={() => setActiveTab('ingestion')}>Review Data &amp; Documents</button></div>}
    {result && <CarbonResultPanel result={result} />}
    <div className="gb-carbon-next"><button className="gb-text-button" onClick={() => setActiveTab('overview')}>Back to Overview</button>
      {result && <button className="gb-button gb-primary" onClick={() => setActiveTab('actions')}>Explore Transition Actions <ArrowRight size={15} /></button>}</div>
  </section>;
};
