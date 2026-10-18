import React, { useEffect, useRef, useState } from 'react';
import { useTransition } from '../context/TransitionContext';
import { DOCUMENTED_EMISSION_FACTORS } from '../utils/carbonFactors';
import { ArrowRight, X } from 'lucide-react';

const ACTIVITY_LABELS: Record<string, string> = {
  electricity: 'Electricity', fuel_diesel: 'Diesel', fuel_petrol: 'Petrol',
  fuel_gas: 'Natural Gas', fuel_lpg: 'LPG', water: 'Water', refrigerant: 'Refrigerants',
};
const number = (value: number) => new Intl.NumberFormat('en-MY', { maximumFractionDigits: 2 }).format(value);

export const CarbonAccountingView: React.FC = () => {
  const { baseline, profile, updateProfile, setActiveTab } = useTransition();
  const [showMethodology, setShowMethodology] = useState(false);
  const methodologyRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = methodologyRef.current;
    if (showMethodology && dialog && !dialog.open) dialog.showModal();
    else if (!showMethodology && dialog?.open) dialog.close();
  }, [showMethodology]);
  const confidence = baseline.dataConfidence;
  // These are the existing displayed shares/distributions, not new analysis.
  const scope1Share = baseline.totalTCO2e > 0 ? ((baseline.scope1TCO2e / baseline.totalTCO2e) * 100).toFixed(1) : '0';
  const scope2Share = baseline.totalTCO2e > 0 ? ((baseline.scope2TCO2e / baseline.totalTCO2e) * 100).toFixed(1) : '0';
  const qualityGroups = [
    { label: 'Measured', value: confidence.measuredPct, className: 'gb-quality-measured' },
    { label: 'Invoice-derived', value: confidence.invoiceDerivedPct, className: 'gb-quality-invoice' },
    { label: 'Estimated / Proxy', value: confidence.estimatedPct + confidence.proxyPct, className: 'gb-quality-estimated' },
  ];

  return (
    <section className="gb-carbon-page" aria-labelledby="carbon-heading">
      <div className="gb-page-heading gb-carbon-heading">
        <div className="gb-carbon-title"><h1 id="carbon-heading">Carbon Analysis</h1><span className="gb-status">GHG Protocol Aligned</span></div>
        <label className="gb-grid-region">Grid Region
          <select value={profile.gridRegion || 'Peninsular Malaysia'} onChange={event => updateProfile({ gridRegion: event.target.value })}>
            <option value="Peninsular Malaysia">Peninsular Malaysia</option>
            <option value="Sabah / Sarawak">Sabah / Sarawak</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="United States">United States Average</option>
            <option value="European Union">European Union</option>
          </select>
        </label>
      </div>

      <div className="gb-carbon-kpis">
        <article className="gb-carbon-kpi gb-carbon-kpi-total"><h2>Total Carbon Footprint</h2><div><strong>{number(baseline.totalTCO2e)}</strong><span>tCO<sub>2</sub>e</span></div><p>Reporting year {profile.reportingYear}</p><small>Data confidence: {number(confidence.overallScorePct)}% | {confidence.level}</small></article>
        <article className="gb-carbon-kpi"><h2>Scope 1 - Direct Emissions</h2><div><strong>{number(baseline.scope1TCO2e)}</strong><span>tCO<sub>2</sub>e</span></div><p>Fuel and direct operational emissions</p><small>{scope1Share}% of total footprint</small></article>
        <article className="gb-carbon-kpi"><h2>Scope 2 - Purchased Electricity</h2><div><strong>{number(baseline.scope2TCO2e)}</strong><span>tCO<sub>2</sub>e</span></div><p>Purchased grid electricity</p><small>{scope2Share}% of total footprint</small></article>
      </div>

      <div className="gb-carbon-body">
        <article className="gb-carbon-sources gb-panel" aria-labelledby="carbon-sources-heading">
          <h2 id="carbon-sources-heading">Emissions by Activity Category</h2>
          {baseline.emissionsByFuel.length ? <ul className="gb-carbon-source-list">{baseline.emissionsByFuel.map(fuel => (
            <li key={fuel.category}>
              <div><strong>{ACTIVITY_LABELS[fuel.category] || fuel.name}</strong><span>{number(fuel.emissionsTCO2e)} tCO<sub>2</sub>e <small>{number(fuel.percentage)}%</small></span></div>
              <div className="gb-carbon-source-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, fuel.percentage))}%` }} /></div>
            </li>
          ))}</ul> : <p className="gb-carbon-empty">Add utility bills and fuel records in Data &amp; Documents to see your emission sources.</p>}
        </article>

        <article className="gb-carbon-quality gb-panel" aria-labelledby="carbon-quality-heading">
          <div className="gb-panel-heading"><h2 id="carbon-quality-heading">Data Confidence</h2><strong>{number(confidence.overallScorePct)}% <span>{confidence.level}</span></strong></div>
          <ul>{qualityGroups.map(group => <li key={group.label}><div><span>{group.label}</span><strong>{number(group.value)}%</strong></div><div className={`gb-quality-track ${group.className}`} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, group.value))}%` }} /></div></li>)}</ul>
        </article>

        <article className="gb-carbon-intensity gb-panel" aria-labelledby="carbon-intensity-heading">
          <h2 id="carbon-intensity-heading">Carbon Intensity</h2>
          <dl><div><dt>Revenue Intensity<small>tCO<sub>2</sub>e / {profile.currency === 'MYR' ? 'RM' : profile.currency} 1 million revenue</small></dt><dd>{number(baseline.intensityMetrics.tco2ePerMillionRevenue)}</dd></div><div><dt>Employee Intensity<small>tCO<sub>2</sub>e / employee</small></dt><dd>{number(baseline.intensityMetrics.tco2ePerEmployee)}</dd></div></dl>
        </article>
      </div>

      <div className="gb-carbon-next"><button className="gb-text-button" aria-haspopup="dialog" onClick={() => setShowMethodology(true)}>View methodology &amp; emission factors</button><button className="gb-button gb-primary" onClick={() => setActiveTab('actions')}>Explore Transition Actions <ArrowRight size={15} /></button></div>

      <dialog ref={methodologyRef} className="gb-action-dialog gb-carbon-methodology" aria-labelledby="methodology-heading" onCancel={() => setShowMethodology(false)} onClose={() => setShowMethodology(false)}>
        <div className="gb-action-dialog-heading"><h2 id="methodology-heading">Methodology &amp; emission factors</h2><button className="gb-button" aria-label="Close methodology" onClick={() => setShowMethodology(false)}><X size={16} /></button></div>
        <div className="gb-action-dialog-body">
          <section className="gb-panel"><h3>Calculation approach</h3><p>Scope 1 and Scope 2 totals aggregate the emissions stored in your activity records. Activity emissions use quantity multiplied by the recorded factor, divided by 1,000 to convert kilograms to tonnes. Intensity values normalize the baseline by revenue and employee count. Emission factors and their documented sources are listed below.</p><p>Confidence uses the existing measured, invoice-derived, estimated and proxy quality tiers, weighted at 100%, 90%, 50% and 25%, with the existing monthly coverage adjustment. Confidence is a calculated indicator, not independent verification.</p><p>Factor references include DEFRA, IPCC and national grid sources. The selected grid region is {profile.gridRegion || 'Peninsular Malaysia'}. Stored activity factors and calculations remain unchanged by this view.</p><dl className="gb-facts"><div><dt>Facility area intensity</dt><dd>{number(baseline.intensityMetrics.kgco2ePerSqMFloorArea)} kgCO2e / m2</dd></div><div><dt>Activity records</dt><dd>{confidence.totalRecords}</dd></div></dl></section>
          <section className="gb-panel"><h3>Data review</h3>{confidence.missingPeriods.length > 0 && <ul>{confidence.missingPeriods.map((period, index) => <li key={index}>{period}</li>)}</ul>}{confidence.recommendations.length > 0 && <ul>{confidence.recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}</ul>}<div className="gb-methodology-links"><button className="gb-button" onClick={() => setActiveTab('ingestion')}>View source documents</button><button className="gb-button" onClick={() => setActiveTab('audit')}>View audit trail</button></div></section>
          <section className="gb-panel"><h3>Documented emission factors</h3><div className="gb-table-scroll"><table><thead><tr><th>Activity</th><th>Scope</th><th>Factor</th><th>Source</th><th>Region / Year</th><th>Methodology</th></tr></thead><tbody>{DOCUMENTED_EMISSION_FACTORS.map((factor, index) => <tr key={index}><td>{factor.name}</td><td>{factor.scope}</td><td>{factor.factorKgCO2e} kgCO2e / {factor.unit}</td><td>{factor.source}</td><td>{factor.region} / {factor.effectiveYear}</td><td>{factor.notes}</td></tr>)}</tbody></table></div></section>
        </div>
      </dialog>
    </section>
  );
};
