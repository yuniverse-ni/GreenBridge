import React, { useEffect, useRef, useState } from 'react';
import { useTransition } from '../context/TransitionContext';
import { formatCurrency } from '../utils/transitionCalculations';
import { Coins, ChevronLeft, ChevronRight, X } from 'lucide-react';

type ScopeFilter = 'All Scopes' | 'Scope 1' | 'Scope 2';
const PAGE_SIZE = 3;

export const DecarbonisationActionsView: React.FC = () => {
  const { allActions, selectedActionIds, toggleAction, profile, baseline, setActiveTab } = useTransition();
  const [scope, setScope] = useState<ScopeFilter>('All Scopes');
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const supportedActions = allActions.filter(item => item.scopeTarget === 'Scope 1' || item.scopeTarget === 'Scope 2');
  const action = supportedActions.find(item => item.id === detailId);
  const priorities = { High: 0, Medium: 1, Low: 2 };
  const relevantActions = [...supportedActions]
    .filter(item => scope === 'All Scopes' || item.scopeTarget === scope)
    .sort((a, b) => priorities[a.recommendedPriority] - priorities[b.recommendedPriority]
      || b.annualCO2eReductionTons - a.annualCO2eReductionTons
      || a.id.localeCompare(b.id));
  const pageCount = Math.ceil(relevantActions.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleActions = relevantActions.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedActions = supportedActions.filter(item => selectedActionIds.includes(item.id));
  const totalPlannedCapex = selectedActions.reduce((sum, item) => sum + item.capex, 0);
  const totalPlannedSavings = selectedActions.reduce((sum, item) => sum + item.annualOpExSavings, 0);
  const totalPlannedCO2 = selectedActions.reduce((sum, item) => sum + item.annualCO2eReductionTons, 0);
  const totalPlannedMonthlyRepayment = selectedActions.reduce((sum, item) => sum + item.financing.monthlyRepayment, 0);
  const netMonthlyBenefit = Math.round(totalPlannedSavings / 12) - totalPlannedMonthlyRepayment;
  const number = (value: number) => new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(value);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ((action || showPlan) && !dialog.open) dialog.showModal();
    else if (!action && !showPlan && dialog.open) dialog.close();
  }, [action, showPlan]);
  const closeDetails = () => { setDetailId(null); setShowPlan(false); };

  return (
    <section className="gb-actions-page" aria-labelledby="actions-heading">
      <div className="gb-page-heading">
        <div><h1 id="actions-heading">Decarbonisation Actions</h1></div>
        <div className="gb-header-actions"><button className="gb-button" onClick={() => setShowPlan(true)}>Selected plan ({selectedActions.length})</button>
          <button className="gb-button gb-primary" onClick={() => setActiveTab('copilot')}>Review with AI Copilot</button></div>
      </div>
      <div className="gb-scope-guide" aria-label="Emission scope explanation">
        <span>Emission Scope</span>
        <p><strong>Scope 1</strong> - Direct fuel/emissions</p>
        <p><strong>Scope 2</strong> - Purchased electricity</p>
      </div>
      <div className="gb-action-toolbar">
        <label>Emission Scope
          <select value={scope} onChange={event => { setScope(event.target.value as ScopeFilter); setPage(0); }}>
            {(['All Scopes', 'Scope 1', 'Scope 2'] as const).map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <p>Ordered by priority, then annual carbon reduction</p>
      </div>
      {visibleActions.length ? (
        <div className="gb-action-cards">
          {visibleActions.map(item => (
            <article className={`gb-action-card ${selectedActionIds.includes(item.id) ? 'is-selected' : ''}`} key={item.id}>
              <div className="gb-action-card-heading">
                <span>{item.scopeTarget}</span>
                <input type="checkbox" aria-label={`Include ${item.title} in selected plan`} checked={selectedActionIds.includes(item.id)} onChange={() => toggleAction(item.id)} />
              </div>
              <h2>{item.title}</h2>
              <dl>
                <div><dt>CAPEX</dt><dd>{formatCurrency(item.capex, profile.currency)}</dd></div>
                <div><dt>Annual savings</dt><dd>{formatCurrency(item.annualOpExSavings, profile.currency)}</dd></div>
                <div><dt>CO<sub>2</sub> reduction</dt><dd>{number(item.annualCO2eReductionTons)} <small>tCO<sub>2</sub>e / year</small></dd></div>
                <div><dt>Payback</dt><dd>{number(item.paybackPeriodYears)} <small>years</small></dd></div>
              </dl>
              <button className="gb-button" aria-haspopup="dialog" onClick={() => setDetailId(item.id)}>View details</button>
            </article>
          ))}
        </div>
      ) : (
        <div className="gb-actions-empty" role="status"><h2>No actions available for this scope</h2><p>Try another scope or add business activity data.</p></div>
      )}
      <div className="gb-action-pagination">
        <span aria-live="polite">{relevantActions.length ? `${currentPage * PAGE_SIZE + 1}-${Math.min((currentPage + 1) * PAGE_SIZE, relevantActions.length)} of ${relevantActions.length} actions` : '0 actions'}</span>
        {pageCount > 1 && <div><button className="gb-button" aria-label="Previous three actions" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} /> Previous</button><button className="gb-button" aria-label="Next three actions" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next <ChevronRight size={14} /></button></div>}
      </div>
      <dialog ref={dialogRef} className="gb-action-dialog" aria-labelledby="action-details-heading" onCancel={closeDetails} onClose={closeDetails}>
        <div className="gb-action-dialog-heading"><h2 id="action-details-heading">{action?.title || 'Selected roadmap'}</h2><button className="gb-button" aria-label="Close details" onClick={closeDetails}><X size={16} /></button></div>
        <div className="gb-action-dialog-body">
          {showPlan && <div className="gb-panel"><h3>Selected roadmap portfolio</h3><dl className="gb-facts"><div><dt>Total CAPEX</dt><dd>{formatCurrency(totalPlannedCapex, profile.currency)}</dd></div><div><dt>Annual savings</dt><dd>{formatCurrency(totalPlannedSavings, profile.currency)}</dd></div><div><dt>Annual carbon reduction</dt><dd>{number(totalPlannedCO2)} tCO2e ({baseline.totalTCO2e > 0 ? ((totalPlannedCO2 / baseline.totalTCO2e) * 100).toFixed(0) : 0}% of baseline)</dd></div><div><dt>Monthly repayment</dt><dd>{formatCurrency(totalPlannedMonthlyRepayment, profile.currency)}</dd></div><div><dt>Net monthly cash impact</dt><dd>{formatCurrency(netMonthlyBenefit, profile.currency)}</dd></div></dl>{selectedActions.map(item => <label className="gb-selected-action-row" key={item.id}><input type="checkbox" checked onChange={() => toggleAction(item.id)} />{item.title}</label>)}{!selectedActions.length && <p>No actions selected.</p>}</div>}
          {action && <>
            <p className="gb-action-description">{action.description}</p>
            <p className="gb-action-detail-meta">{action.scopeTarget} | {action.category} | {action.recommendedPriority} priority</p>
                <div className="bg-slate-50/70 border-t border-slate-200 p-5 space-y-5">
                  {/* Financing Simulation Strip */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Indicative Green Loan Financing Structure</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">Loan Principal</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                          {formatCurrency(action.financing.loanPrincipal, profile.currency)}
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">Monthly Loan Repay</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                          {formatCurrency(action.financing.monthlyRepayment, profile.currency)} / mo
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">Monthly Bill Savings</span>
                        <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                          {formatCurrency(action.annualOpExSavings / 12, profile.currency)} / mo
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">Net Monthly Benefit</span>
                        <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                          {formatCurrency(action.financing.netMonthlyCashFlowImpact, profile.currency)} / mo
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">10-Year NPV</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                          {formatCurrency(action.tenYearNpv, profile.currency)}
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">CO2 Abatement Cost</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                          {action.marginalAbatementCost} / tCO2e
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Technical Assumptions & Regulatory Standards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-800 block mb-2">Technical Sizing & Assumptions:</span>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        {action.assumptions.map((asm, i) => (
                          <li key={i}>{asm}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-800 block mb-2">Accreditation & Standards:</span>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        {action.regulatoryStandards.map((std, i) => (
                          <li key={i}>{std}</li>
                        ))}
                      </ul>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Implementation Timeline:</span>
                        <span className="font-semibold text-slate-800">{action.implementationTimeMonths} Months</span>
                      </div>
                    </div>
                  </div>
                </div>
          </>}
        </div>
      </dialog>
    </section>
  );
};
