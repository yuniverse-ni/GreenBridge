import React from 'react';
import { useTransition } from '../context/TransitionContext';
import { ArrowRight, UploadCloud } from 'lucide-react';
import { formatCurrency } from '../utils/transitionCalculations';

export const OverviewView: React.FC = () => {
  const {
    profile, baseline, financial, selectedActions,
    activityRecords, setActiveTab, navigateToUpload,
  } = useTransition();
  const isWorkspaceEmpty = activityRecords.length === 0;
  const totalPlannedCapex = selectedActions.reduce((sum, action) => sum + action.capex, 0);
  const totalPlannedSavings = selectedActions.reduce((sum, action) => sum + action.annualOpExSavings, 0);

  return <section className="gb-dashboard">
    <div className="gb-page-heading"><div><div className="gb-eyebrow">TRANSITION FINANCE WORKSPACE</div><h1>Overview</h1><p>Your operating baseline, selected investments and evidence in one view.</p></div><div className="gb-header-actions"><button className="gb-button gb-primary" onClick={() => navigateToUpload('full_business_data', 'hero')}><UploadCloud size={14} /> Add documents</button></div></div>
    <div className="gb-metric-strip"><div><span>Carbon Baseline</span><strong>{baseline.totalTCO2e} <small>tCO2e</small></strong></div><div><span>Planned Investment</span><strong>{formatCurrency(totalPlannedCapex, profile.currency)}</strong></div><div><span>Projected Annual Savings</span><strong>{formatCurrency(totalPlannedSavings, profile.currency)}</strong></div><div><span>Current DSCR</span><strong>{financial.currentDscr.toFixed(2)}<small>x</small></strong></div></div>
    <div className="gb-overview-grid"><article className="gb-panel gb-overview-roadmap"><div className="gb-panel-heading"><h2>Selected Transition Roadmap</h2><button className="gb-text-button" onClick={() => setActiveTab('actions')}>Manage actions <ArrowRight size={13} /></button></div><p>Projected equipment and financing outcomes; validate against source evidence.</p><div className="gb-table-scroll"><table><thead><tr><th>Intervention</th><th>Investment</th><th>Annual savings</th><th>Carbon reduction</th></tr></thead><tbody>{!isWorkspaceEmpty && selectedActions.map(a => <tr key={a.id}><td>{a.title}<small>{a.recommendedPriority} priority | {a.paybackPeriodYears} year payback</small></td><td>{formatCurrency(a.capex, profile.currency)}</td><td>{formatCurrency(a.annualOpExSavings, profile.currency)}</td><td>{a.annualCO2eReductionTons} t / year</td></tr>)}{(isWorkspaceEmpty || !selectedActions.length) && <tr><td colSpan={4}>Upload records and select interventions to build your roadmap.</td></tr>}</tbody></table></div><div className="gb-overview-actions"><button className="gb-button" onClick={() => setActiveTab('copilot')}>Review with AI Copilot <ArrowRight size={14} /></button><button className="gb-button gb-primary" onClick={() => setActiveTab('transition-plan')}>Prepare Lender Pack <ArrowRight size={14} /></button></div></article>
    <article className="gb-panel gb-overview-summary"><h2>Carbon &amp; Evidence</h2><dl className="gb-facts"><div><dt>Scope 1</dt><dd>{baseline.scope1TCO2e} tCO2e</dd></div><div><dt>Scope 2</dt><dd>{baseline.scope2TCO2e} tCO2e</dd></div><div><dt>Activity records</dt><dd>{activityRecords.length}</dd></div><div><dt>Data confidence</dt><dd>{baseline.dataConfidence.overallScorePct}% | {baseline.dataConfidence.level}</dd></div></dl><button className="gb-text-button" onClick={() => setActiveTab('baseline')}>View carbon analysis <ArrowRight size={13} /></button></article>
    <article className="gb-panel gb-overview-summary"><h2>Financial Position</h2><dl className="gb-facts"><div><dt>Annual revenue</dt><dd>{formatCurrency(financial.annualRevenue, profile.currency)}</dd></div><div><dt>Cash balance</dt><dd>{formatCurrency(financial.cashBalance, profile.currency)}</dd></div><div><dt>Annual utility costs</dt><dd>{formatCurrency(financial.totalUtilityCost, profile.currency)}</dd></div><div><dt>CapEx budget</dt><dd>{formatCurrency(profile.maxCapExBudget, profile.currency)}</dd></div></dl><button className="gb-text-button" onClick={() => setActiveTab('financials')}>View financial analysis <ArrowRight size={13} /></button></article>
    </div>
  </section>;
};
