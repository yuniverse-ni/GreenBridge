// TransitionAI — Deterministic Financial Analysis & Comprehensive Statement Engine
// Full 7-Sheet Financial Model, Ratio Diagnostics, 12-Month Forward Cash Budget, and Malaysian SME Tax Engine

import React, { useEffect, useRef, useState } from 'react';
import { useTransition } from '../context/TransitionContext';
import {
  calculate_cash_flow,
  calculate_debt_capacity,
  formatCurrency
} from '../utils/transitionCalculations';
import {
  get_standard_sme_financial_model,
  calculate_12_month_cash_budget,
  calculate_malaysian_sme_tax,
  calculate_income_statement,
  calculate_balance_sheet,
  calculate_cash_flow_statement,
  calculate_financial_ratios
} from '../utils/financialEngine';
import {
  Coins,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Sliders,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Scale,
  DollarSign,
  TrendingDown,
  Info,
  Clock,
  Briefcase,
  X
} from 'lucide-react';

export const FinancialAnalysisView: React.FC = () => {
  const { financial, profile, selectedActions, updateProfile, setActiveTab } = useTransition();

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'statements' | 'ratios' | 'budget' | 'tax'
  >('overview');

  const [showFinancialDetails, setShowFinancialDetails] = useState(false);
  const financialDetailsRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = financialDetailsRef.current;
    if (showFinancialDetails && dialog && !dialog.open) dialog.showModal();
    else if (!showFinancialDetails && dialog?.open) dialog.close();
  }, [showFinancialDetails]);

  // Interactive Debt Simulation Parameters
  const [interactiveInterestRate, setInteractiveInterestRate] = useState<number>(3.75); // Concessionary rate %
  const [interactiveTenureYears, setInteractiveTenureYears] = useState<number>(7);
  const [interactiveTargetDscr, setInteractiveTargetDscr] = useState<number>(profile.minDscrRequirement || 1.25);

  // 12-Month Cash Budget Config
  const [cashBufferInput, setCashBufferInput] = useState<number>(profile.cashBalance > 0 ? Math.min(100000, profile.cashBalance * 0.3) : 50000);
  const [collM0, setCollM0] = useState<number>(50);
  const [collM1, setCollM1] = useState<number>(30);
  const [collM2, setCollM2] = useState<number>(20);

  // Tax Model State
  const [taxNonDeductible, setTaxNonDeductible] = useState<number>(35000);
  const [taxCapitalAllowances, setTaxCapitalAllowances] = useState<number>(85000);
  const [taxInstallmentsPaid, setTaxInstallmentsPaid] = useState<number>(60000);

  // Baseline standard model for precision manufacturing SME
  const standardModel = get_standard_sme_financial_model();

  // Recomputed 12-month budget based on user buffer & collection schedule
  const dynamicBudget = calculate_12_month_cash_budget({
    initialOpeningCash: financial.cashBalance > 0 ? financial.cashBalance : standardModel.balanceSheet.cash,
    minimumCashBuffer: cashBufferInput,
    monthlySales: [
      250000, 260000, 240000, 270000, 280000, 290000,
      275000, 265000, 285000, 300000, 310000, 320000
    ],
    cashSalesPct: 20,
    collectionSchedule: {
      currentMonthPct: collM0,
      oneMonthLaterPct: collM1,
      twoMonthsLaterPct: collM2
    },
    monthlyPurchases: [
      145000, 150000, 139000, 156000, 162000, 168000,
      159000, 153000, 165000, 174000, 179000, 185000
    ],
    supplierPaymentCurrentPct: 60,
    monthlyOpEx: Array(12).fill(56000),
    monthlyPrincipalRepayments: Array(12).fill(4500),
    monthlyInterestPayments: Array(12).fill(2500),
    monthLabels: [
      'Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025',
      'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'
    ]
  });

  // Recomputed tax based on state
  const dynamicTax = calculate_malaysian_sme_tax({
    taxYear: 2024,
    accountingProfit: standardModel.incomeStatement.profitBeforeTax,
    nonDeductibleExpenses: taxNonDeductible,
    capitalAllowances: taxCapitalAllowances,
    taxInstallmentsPaid
  });

  // Compute total planned capex and annual savings
  const totalPlannedCapex = selectedActions.reduce((sum, a) => sum + a.capex, 0);
  const totalPlannedSavings = selectedActions.reduce((sum, a) => sum + a.annualOpExSavings, 0);

  // Dynamic Debt Capacity based on user sliders
  const dynamicDebtCapacity = calculate_debt_capacity(
    financial.ebitda,
    financial.existingDebtService,
    interactiveTargetDscr,
    interactiveInterestRate,
    interactiveTenureYears
  );

  // 7-Year Cash Flow Projections
  const cashFlowWaterfall = calculate_cash_flow(
    financial.annualRevenue,
    financial.annualOpEx,
    totalPlannedSavings,
    totalPlannedCapex > 0 ? (totalPlannedCapex / interactiveTenureYears) + (totalPlannedCapex * (interactiveInterestRate / 100) * 0.5) : 0,
    totalPlannedCapex * 0.10, // 10% equity contribution
    7
  );

  const { incomeStatement: is, balanceSheet: bs, cashFlowStatement: cfs, ratios } = standardModel;

  return (
    <section className="gb-financial-analysis" aria-labelledby="financial-analysis-heading">
      <div className="gb-page-heading"><div><h1 id="financial-analysis-heading">Financial Analysis</h1><p>Assess the SME's financial position and capacity to fund transition investments.</p></div></div>
      <div className="gb-financial-kpis">
        <article><h2>Annual Revenue</h2><strong>{formatCurrency(financial.annualRevenue, profile.currency)}</strong></article>
        <article><h2>Operating EBITDA</h2><strong>{formatCurrency(financial.ebitda, profile.currency)}</strong></article>
        <article><h2>Available Cash</h2><strong>{formatCurrency(financial.cashBalance, profile.currency)}</strong></article>
        <article><h2>Current DSCR</h2><strong>{financial.currentDscr >= 50 ? '> 10.0x' : `${financial.currentDscr.toFixed(2)}x`}</strong></article>
      </div>
      <div className="gb-financial-columns">
        <article className="gb-panel"><h2>Financial Position</h2><dl className="gb-financial-facts">
          <div><dt>Operating Expenses</dt><dd>{formatCurrency(financial.annualOpEx, profile.currency)}</dd></div>
          <div><dt>Existing Annual Debt Service</dt><dd>{formatCurrency(financial.existingDebtService, profile.currency)}</dd></div>
          <div><dt>Available CAPEX Budget</dt><dd>{formatCurrency(profile.maxCapExBudget, profile.currency)}</dd></div>
          <div><dt>Minimum Cash Reserve<small>Existing cash-budget assumption</small></dt><dd>{formatCurrency(cashBufferInput, profile.currency)}</dd></div>
          <div><dt>Current DSCR</dt><dd>{financial.currentDscr >= 50 ? '> 10.0x' : `${financial.currentDscr.toFixed(2)}x`}</dd></div>
        </dl></article>
        <article className="gb-panel gb-affordability-panel"><h2>Transition Affordability</h2><dl className="gb-financial-facts">
          <div><dt>Available CAPEX Capacity<small>Declared project budget</small></dt><dd>{formatCurrency(profile.maxCapExBudget, profile.currency)}</dd></div>
          <div><dt>Estimated Financing Capacity</dt><dd>{formatCurrency(financial.maxBorrowingCapacityAtTargetDscr, profile.currency)}</dd></div>
          <div><dt>Remaining Cash After Investment</dt><dd className="gb-unavailable-value">Not supplied</dd></div>
          <div><dt>Affordability Status</dt><dd className="gb-affordability-status">{!financial.isSufficientData ? 'More data needed' : financial.currentDscr >= profile.minDscrRequirement ? 'Meets current DSCR threshold' : 'Review debt coverage'}</dd></div>
        </dl><p className="gb-affordability-note">Affordability estimate only; financing remains subject to lender review.</p></article>
      </div>
      <div className="gb-financial-next"><button className="gb-button" aria-haspopup="dialog" onClick={() => { setActiveSubTab('statements'); setShowFinancialDetails(true); }}>View financial details</button><button className="gb-button gb-primary" onClick={() => setActiveTab('actions')}>Explore Transition Actions <ArrowRight size={15} /></button></div>
      <dialog ref={financialDetailsRef} className="gb-action-dialog gb-financial-details" aria-labelledby="financial-details-heading" onCancel={() => setShowFinancialDetails(false)} onClose={() => setShowFinancialDetails(false)}>
        <div className="gb-action-dialog-heading"><h2 id="financial-details-heading">Financial details</h2><button className="gb-button" aria-label="Close financial details" onClick={() => setShowFinancialDetails(false)}><X size={16} /></button></div>
        <div className="gb-financial-detail-picker"><label>Detail view<select value={activeSubTab} onChange={event => setActiveSubTab(event.target.value as typeof activeSubTab)}><option value="statements">Financial statements</option><option value="ratios">Financial ratios</option><option value="budget">Cash budget</option><option value="tax">Tax estimates</option><option value="overview">Financing simulation & cash flows</option></select></label><p>Statements, budget and tax retain the existing illustrative model and inputs; verify them against company records.</p></div>
        <div className="gb-action-dialog-body gb-financial-detail-body">
      {/* SUB-TAB 1: Debt Capacity & DSCR Overview */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Interactive Debt Capacity Simulator */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Transition Financing Capacity Simulator
                </h3>
                <p className="text-xs text-slate-500">
                  Simulate maximum borrowing headroom under commercial vs concessionary green financing covenants.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Simulated Debt Capacity</span>
                <div className="text-2xl font-extrabold text-blue-700">
                  {formatCurrency(dynamicDebtCapacity.maxLoanAmount, profile.currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Interest Rate:</span>
                  <span className="text-emerald-700">{interactiveInterestRate}% p.a.</span>
                </div>
                <input
                  type="range"
                  min="2.5"
                  max="8.0"
                  step="0.25"
                  value={interactiveInterestRate}
                  onChange={(e) => setInteractiveInterestRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>2.5% (BNM LCTF)</span>
                  <span>5.5% (Commercial)</span>
                  <span>8.0%</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Loan Tenure:</span>
                  <span className="text-blue-700">{interactiveTenureYears} Years</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={interactiveTenureYears}
                  onChange={(e) => setInteractiveTenureYears(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>3 yrs</span>
                  <span>7 yrs (Standard)</span>
                  <span>10 yrs</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Target DSCR Covenant:</span>
                  <span className="text-amber-700">{interactiveTargetDscr}x</span>
                </div>
                <input
                  type="range"
                  min="1.1"
                  max="1.75"
                  step="0.05"
                  value={interactiveTargetDscr}
                  onChange={(e) => setInteractiveTargetDscr(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>1.10x (Relaxed)</span>
                  <span>1.25x (BNM Baseline)</span>
                  <span>1.75x</span>
                </div>
              </div>
            </div>

            {/* Assumptions & Formula Transparency */}
            <div className="text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-1.5 text-slate-600">
              <span className="font-bold text-slate-800 uppercase text-[10px] block">
                Deterministic Capacity Formula & Assumptions Disclosed:
              </span>
              <p>• Max Annual Debt Service = (Operating EBITDA ÷ Target DSCR) - Existing Debt Service.</p>
              <p>• Max Loan Supportable = Present Value (PV) of annuity cash flows over {interactiveTenureYears} years at {interactiveInterestRate}%.</p>
              <p className="text-slate-500 italic">
                Notice: This capacity is a mathematical feasibility calculation, not a credit decision from a bank or financial institution.
              </p>
            </div>
          </div>

          {/* 7-Year Cash Flow Waterfall Projections */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              7-Year Post-Intervention Cash Flow Waterfall
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Simulates annual operating cash flows factoring in {formatCurrency(totalPlannedSavings, profile.currency)} annual energy bill reductions.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Horizon</th>
                    <th className="py-2.5 px-3">Baseline Net Cash Flow</th>
                    <th className="py-2.5 px-3">Post-Intervention Net Cash</th>
                    <th className="py-2.5 px-3">Net Annual Benefit</th>
                    <th className="py-2.5 px-3">Cumulative Benefit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {cashFlowWaterfall.map((row) => (
                    <tr key={row.year} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 font-sans">Year {row.year}</td>
                      <td className="py-2.5 px-3">{formatCurrency(row.baselineNetCash, profile.currency)}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {formatCurrency(row.postInterventionNetCash, profile.currency)}
                      </td>
                      <td className={`py-2.5 px-3 font-bold ${row.netIncrementalBenefit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {row.netIncrementalBenefit >= 0 ? '+' : ''}{formatCurrency(row.netIncrementalBenefit, profile.currency)}/yr
                      </td>
                      <td className={`py-2.5 px-3 font-bold ${row.cumulativeCashGain >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {row.cumulativeCashGain >= 0 ? '+' : ''}{formatCurrency(row.cumulativeCashGain, profile.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Financial Statements (P&L, Balance Sheet & Cash Flow) */}
      {activeSubTab === 'statements' && (
        <div className="space-y-6">
          {/* Income Statement Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Income Statement (P&L) — {is.period}</h3>
                <p className="text-xs text-slate-500">Standardized accounting definitions: Gross Profit, EBITDA, EBIT, PBT, Net Profit</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg">
                Net Margin: {((is.netProfit / is.revenue) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600 font-sans">Gross Revenue:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(is.revenue, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-red-600">
                  <span className="font-sans">Cost of Goods Sold (COGS):</span>
                  <span>-{formatCurrency(is.cogs, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold text-emerald-800 bg-emerald-50/50 px-2 rounded">
                  <span className="font-sans">Gross Profit:</span>
                  <span>{formatCurrency(is.grossProfit, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-slate-700">
                  <span className="font-sans">Operating Expenses (OpEx):</span>
                  <span>-{formatCurrency(is.operatingExpenses, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold text-slate-900 bg-blue-50/50 px-2 rounded">
                  <span className="font-sans">EBITDA:</span>
                  <span>{formatCurrency(is.ebitda, profile.currency)}</span>
                </div>
              </div>

              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                  <span className="font-sans">Depreciation & Amortisation:</span>
                  <span>-{formatCurrency(is.depreciationAmortisation, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold text-slate-900">
                  <span className="font-sans">EBIT / Operating Profit:</span>
                  <span>{formatCurrency(is.ebit, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                  <span className="font-sans">Finance Costs (Interest):</span>
                  <span>-{formatCurrency(is.financeCosts, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold text-slate-900">
                  <span className="font-sans">Profit Before Tax (PBT):</span>
                  <span>{formatCurrency(is.profitBeforeTax, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                  <span className="font-sans">Income Tax Expense:</span>
                  <span>-{formatCurrency(is.incomeTaxExpense, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 font-extrabold text-emerald-900 bg-emerald-100 px-2 rounded">
                  <span className="font-sans">Net Profit:</span>
                  <span>{formatCurrency(is.netProfit, profile.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Balance Sheet Card with Reconciliation Check */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Balance Sheet — {bs.period}</h3>
                <p className="text-xs text-slate-500">Roll-forward logic for Fixed Assets & Retained Earnings</p>
              </div>

              {/* Mandatory Reconciliation Check (Part 3.5 & Test F) */}
              <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                bs.isReconciled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                {bs.isReconciled ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                <span>
                  {bs.isReconciled
                    ? 'Reconciliation Check: Balanced (Diff RM 0.00)'
                    : `Discrepancy: RM ${bs.reconciliationDifference.toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* Assets Column */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 font-sans block mb-2 uppercase text-[11px]">Assets</span>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Cash & Bank Balances:</span>
                  <span>{formatCurrency(bs.cash, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Accounts Receivable (AR):</span>
                  <span>{formatCurrency(bs.accountsReceivable, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Inventory:</span>
                  <span>{formatCurrency(bs.inventory, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-100 px-1 rounded">
                  <span className="font-sans">Total Current Assets:</span>
                  <span>{formatCurrency(bs.currentAssets, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Fixed Assets at Cost:</span>
                  <span>{formatCurrency(bs.fixedAssetsAtCost, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-red-600">
                  <span className="font-sans">Accumulated Depreciation:</span>
                  <span>-{formatCurrency(bs.accumulatedDepreciation, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-100 px-1 rounded">
                  <span className="font-sans">Net Fixed Assets:</span>
                  <span>{formatCurrency(bs.netFixedAssets, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-2 font-extrabold text-blue-900 bg-blue-50 px-2 rounded mt-2">
                  <span className="font-sans">Total Assets:</span>
                  <span>{formatCurrency(bs.totalAssets, profile.currency)}</span>
                </div>
              </div>

              {/* Liabilities & Equity Column */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 font-sans block mb-2 uppercase text-[11px]">Liabilities & Equity</span>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Accounts Payable (AP):</span>
                  <span>{formatCurrency(bs.accountsPayable, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Short-Term Debt:</span>
                  <span>{formatCurrency(bs.shortTermDebt, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-100 px-1 rounded">
                  <span className="font-sans">Total Current Liabilities:</span>
                  <span>{formatCurrency(bs.currentLiabilities, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Long-Term Debt:</span>
                  <span>{formatCurrency(bs.longTermDebt, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-100 px-1 rounded">
                  <span className="font-sans">Total Liabilities:</span>
                  <span>{formatCurrency(bs.totalLiabilities, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Paid-up Capital:</span>
                  <span>{formatCurrency(bs.capital, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-sans">Retained Earnings:</span>
                  <span>{formatCurrency(bs.retainedEarnings, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-100 px-1 rounded">
                  <span className="font-sans">Total Equity:</span>
                  <span>{formatCurrency(bs.totalEquity, profile.currency)}</span>
                </div>
                <div className="flex justify-between py-2 font-extrabold text-blue-900 bg-blue-50 px-2 rounded mt-2">
                  <span className="font-sans">Total Liabilities & Equity:</span>
                  <span>{formatCurrency(bs.totalLiabilitiesAndEquity, profile.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cash Flow Statement Card (Indirect Method) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Cash Flow Statement (Indirect Method) — {cfs.period}</h3>
                <p className="text-xs text-slate-500">Corrects Excel errors: non-cash depreciation add-back & working capital signs</p>
              </div>

              {/* Cash Reconciliation Bar (Test E) */}
              <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                cfs.isReconciled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                {cfs.isReconciled ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                <span>
                  {cfs.isReconciled
                    ? `Closing Cash Reconciled to Balance Sheet: ${formatCurrency(cfs.closingCash, profile.currency)}`
                    : `Discrepancy: RM ${cfs.cashReconciliationDifference.toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="font-sans">Opening Cash Balance:</span>
                <span className="font-bold">{formatCurrency(cfs.openingCash, profile.currency)}</span>
              </div>
              <div className="py-1 text-slate-500 font-sans font-bold uppercase text-[10px]">
                Operating Activities
              </div>
              <div className="flex justify-between pl-4 py-0.5">
                <span className="font-sans">Net Profit:</span>
                <span>{formatCurrency(cfs.netProfit, profile.currency)}</span>
              </div>
              <div className="flex justify-between pl-4 py-0.5 text-emerald-700 font-semibold">
                <span className="font-sans">+ Depreciation Add-Back (Positive Non-Cash):</span>
                <span>+{formatCurrency(cfs.depreciationAddBack, profile.currency)}</span>
              </div>
              <div className="flex justify-between pl-4 py-0.5 text-red-600">
                <span className="font-sans">- Increase in Accounts Receivable:</span>
                <span>{formatCurrency(cfs.deltaAccountsReceivable, profile.currency)}</span>
              </div>
              <div className="flex justify-between pl-4 py-0.5 text-red-600">
                <span className="font-sans">- Increase in Inventory:</span>
                <span>{formatCurrency(cfs.deltaInventory, profile.currency)}</span>
              </div>
              <div className="flex justify-between pl-4 py-0.5 text-emerald-700">
                <span className="font-sans">+ Increase in Accounts Payable:</span>
                <span>+{formatCurrency(cfs.deltaAccountsPayable, profile.currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-100 px-2 rounded">
                <span className="font-sans">Net Operating Cash Flow:</span>
                <span>{formatCurrency(cfs.operatingCashFlow, profile.currency)}</span>
              </div>

              <div className="py-1 text-slate-500 font-sans font-bold uppercase text-[10px]">
                Investing & Financing Activities
              </div>
              <div className="flex justify-between pl-4 py-0.5 text-red-600">
                <span className="font-sans">Capital Expenditure (CapEx Outflow):</span>
                <span>{formatCurrency(cfs.capitalExpenditure, profile.currency)}</span>
              </div>
              <div className="flex justify-between pl-4 py-0.5 text-red-600">
                <span className="font-sans">Principal Loan Repayments:</span>
                <span>{formatCurrency(cfs.principalRepayments, profile.currency)}</span>
              </div>
              <div className="flex justify-between pl-4 py-0.5 text-red-600">
                <span className="font-sans">Owner Drawings / Distributions:</span>
                <span>{formatCurrency(cfs.drawings, profile.currency)}</span>
              </div>

              <div className="flex justify-between py-2 font-extrabold text-slate-900 bg-emerald-50 px-2 rounded mt-2">
                <span className="font-sans">Closing Cash Balance:</span>
                <span>{formatCurrency(cfs.closingCash, profile.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Financial Ratios Grid (Part 4) */}
      {activeSubTab === 'ratios' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">Financial Ratios & Structural Diagnostics</h3>
            <p className="text-xs text-slate-500 mb-4">
              Deterministic ratios with zero-denominator safety guards. Tooltips display underlying arithmetic.
            </p>

            {/* Liquidity Ratios */}
            <div className="mb-6">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                1. Liquidity Ratios
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Current Ratio</span>
                    <span className="font-mono text-[10px] text-slate-400">CA / CL</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.currentRatio.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.currentRatio.explanation}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Quick Ratio</span>
                    <span className="font-mono text-[10px] text-slate-400">(Cash+AR) / CL</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.quickRatio.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.quickRatio.explanation}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Cash Ratio</span>
                    <span className="font-mono text-[10px] text-slate-400">Cash / CL</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.cashRatio.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.cashRatio.explanation}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Working Capital</span>
                    <span className="font-mono text-[10px] text-slate-400">CA - CL</span>
                  </div>
                  <div className="text-xl font-extrabold text-emerald-800 mt-2">{ratios.workingCapital.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Net operational liquidity cushion</p>
                </div>
              </div>
            </div>

            {/* Leverage Ratios */}
            <div className="mb-6">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                2. Leverage & Solvency Ratios
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Total Debt-to-Equity</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.debtToEquityTotal.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.debtToEquityTotal.explanation}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Interest-Bearing D/E</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.debtToEquityInterestBearing.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.debtToEquityInterestBearing.explanation}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Interest Coverage</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.interestCoverage.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.interestCoverage.explanation}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Debt Ratio</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.debtRatio.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.debtRatio.explanation}</p>
                </div>
              </div>
            </div>

            {/* Profitability & Efficiency */}
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                3. Profitability & Working Capital Efficiency
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Gross Margin</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.grossProfitMargin.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{ratios.grossProfitMargin.explanation}</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Days Sales Outstanding (DSO)</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.daysSalesOutstanding.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Corrected formula: Uses AR (not Inventory)</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500">Days Inventory Out (DIO)</span>
                  <div className="text-xl font-extrabold text-slate-900 mt-2">{ratios.daysInventoryOutstanding.formatted}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Positive COGS denominator convention</p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <span className="text-xs font-bold text-emerald-900">Cash Conversion Cycle (CCC)</span>
                  <div className="text-xl font-extrabold text-emerald-950 mt-2">{ratios.cashConversionCycle.formatted}</div>
                  <p className="text-[11px] text-emerald-800 mt-1">{ratios.cashConversionCycle.explanation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: 12-Month Cash Budget & Shortfall Predictor (Part 5) */}
      {activeSubTab === 'budget' && (
        <div className="space-y-6">
          {/* Buffer Control & Inflow Config Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">12-Month Rolling Cash Budget & Shortfall Predictor</h3>
                <p className="text-xs text-slate-500">
                  Month(i).openingCash = Month(i-1).closingCash. Strict debt principal deduction.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-700">Minimum Buffer:</span>
                <input
                  type="number"
                  step="5000"
                  value={cashBufferInput}
                  onChange={(e) => setCashBufferInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Collection schedule sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Month 0 Collection: {collM0}%</label>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={collM0}
                  onChange={(e) => setCollM0(parseInt(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Month +1 Collection: {collM1}%</label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={collM1}
                  onChange={(e) => setCollM1(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Month +2 Collection: {collM2}%</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={collM2}
                  onChange={(e) => setCollM2(parseInt(e.target.value))}
                  className="w-full accent-amber-600"
                />
              </div>
            </div>

            {/* Shortfall Alert Banner if detected */}
            {dynamicBudget.shortfallAlert && (
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 text-amber-950 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-bold text-xs">
                      Cash Shortfall Alert: Cash Drops Below Buffer in {dynamicBudget.shortfallAlert.firstShortfallMonth}
                    </h4>
                    <p className="text-xs text-amber-800 mt-1">
                      Projected closing cash drops to RM {dynamicBudget.shortfallAlert.expectedClosingCash.toLocaleString()} (Shortfall: RM {dynamicBudget.shortfallAlert.shortfallAmount.toLocaleString()} below RM {dynamicBudget.shortfallAlert.minimumBuffer.toLocaleString()} buffer).
                    </p>
                    <div className="mt-2 text-xs text-amber-900 font-semibold">
                      Recommended Mitigation Actions:
                    </div>
                    <ul className="list-disc pl-4 text-[11px] text-amber-800 mt-1 space-y-0.5">
                      {dynamicBudget.shortfallAlert.recommendedActions.map((rec, i) => (
                        <li key={i}>
                          <strong>{rec.action}:</strong> Est. liquidity relief +RM {rec.expectedCashImpact.toLocaleString()} ({rec.timeframe})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Peak Funding Gap</span>
                  <span className="text-xl font-extrabold text-amber-900">
                    RM {dynamicBudget.maximumShortfall.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 12-Month Budget Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs overflow-x-auto">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Full 12-Month Rolling Cash Schedule
            </h4>

            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Month</th>
                  <th className="py-2 px-2.5">Opening Cash</th>
                  <th className="py-2 px-2.5">Receipts</th>
                  <th className="py-2 px-2.5">Disbursements</th>
                  <th className="py-2 px-2.5">Net Change</th>
                  <th className="py-2 px-2.5">Closing Cash</th>
                  <th className="py-2 px-2.5">Buffer Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {dynamicBudget.months.map((m) => (
                  <tr key={m.monthIndex} className={m.hasShortfall ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 px-2.5 font-bold font-sans text-slate-900">{m.monthLabel}</td>
                    <td className="py-2.5 px-2.5">{formatCurrency(m.openingCash, profile.currency)}</td>
                    <td className="py-2.5 px-2.5 text-emerald-700">+{formatCurrency(m.totalCashReceipts, profile.currency)}</td>
                    <td className="py-2.5 px-2.5 text-red-600">-{formatCurrency(m.totalCashDisbursements, profile.currency)}</td>
                    <td className={`py-2.5 px-2.5 font-semibold ${m.netChangeInCash >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatCurrency(m.netChangeInCash, profile.currency)}
                    </td>
                    <td className="py-2.5 px-2.5 font-bold text-slate-900">
                      {formatCurrency(m.closingCash, profile.currency)}
                    </td>
                    <td className="py-2.5 px-2.5">
                      {m.hasShortfall ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                          -RM {m.shortfall.toLocaleString()}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: Malaysian SME Tax Engine (Part 6) */}
      {activeSubTab === 'tax' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Malaysian Statutory Tax Computation (LHDN Form C Model)
                </h3>
                <p className="text-xs text-slate-500">
                  Reconciles accounting profit to taxable income under Income Tax Act 1967 SME tiered rates.
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-800 font-bold text-xs border border-blue-200">
                Effective Rate: {dynamicTax.effectiveTaxRatePct}%
              </span>
            </div>

            {/* Adjustable Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Non-Deductible Add-Backs (RM)</label>
                <input
                  type="number"
                  value={taxNonDeductible}
                  onChange={(e) => setTaxNonDeductible(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Capital Allowances (RM)</label>
                <input
                  type="number"
                  value={taxCapitalAllowances}
                  onChange={(e) => setTaxCapitalAllowances(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CP204 Installments Paid (RM)</label>
                <input
                  type="number"
                  value={taxInstallmentsPaid}
                  onChange={(e) => setTaxInstallmentsPaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-900"
                />
              </div>
            </div>

            {/* Tax Computation Breakdown */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono space-y-2 max-w-2xl">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="font-sans">Accounting Profit Before Tax:</span>
                <span className="font-bold">{formatCurrency(dynamicTax.accountingProfit, profile.currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-800">
                <span className="font-sans">+ Non-Deductible Expenses (Depreciation, Penalties, Private Cars):</span>
                <span>+{formatCurrency(dynamicTax.nonDeductibleExpenses, profile.currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-100 px-2 rounded">
                <span className="font-sans">Adjusted Business Income:</span>
                <span>{formatCurrency(dynamicTax.adjustedBusinessIncome, profile.currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 text-red-600">
                <span className="font-sans">- Capital Allowances Claimed:</span>
                <span>-{formatCurrency(dynamicTax.capitalAllowances, profile.currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 font-extrabold text-blue-900 bg-blue-50 px-2 rounded">
                <span className="font-sans">Chargeable Income:</span>
                <span>{formatCurrency(dynamicTax.chargeableIncome, profile.currency)}</span>
              </div>

              {/* Tier breakdown */}
              <div className="py-2 text-[11px] text-slate-600 border-t border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="font-sans">Tier 1: First RM 150,000 @ 15%:</span>
                  <span>{formatCurrency(Math.min(150000, dynamicTax.chargeableIncome) * 0.15, profile.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans">Tier 2: RM 150,001 to RM 600,000 @ 17%:</span>
                  <span>{formatCurrency(Math.max(0, Math.min(450000, dynamicTax.chargeableIncome - 150000)) * 0.17, profile.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans">Tier 3: In excess of RM 600,000 @ 24%:</span>
                  <span>{formatCurrency(Math.max(0, dynamicTax.chargeableIncome - 600000) * 0.24, profile.currency)}</span>
                </div>
              </div>

              <div className="flex justify-between py-2 font-bold text-slate-900 bg-slate-200 px-2 rounded">
                <span className="font-sans">Calculated Tax Expense:</span>
                <span>{formatCurrency(dynamicTax.calculatedTaxExpense, profile.currency)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span className="font-sans">Less: CP204 Installments Paid to LHDN:</span>
                <span>-{formatCurrency(dynamicTax.taxInstallmentsPaid, profile.currency)}</span>
              </div>
              <div className="flex justify-between py-2 font-extrabold text-emerald-900 bg-emerald-100 px-2 rounded">
                <span className="font-sans">Estimated Balance Tax Payable:</span>
                <span>{formatCurrency(dynamicTax.estimatedBalanceTaxPayable, profile.currency)}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 italic">
              Notice: This is a decision-support tax simulation based on statutory guidelines. Final tax liabilities are subject to Inland Revenue Board (LHDN) assessment and official submission by an approved tax agent.
            </div>
          </div>
        </div>
      )}
        </div>
      </dialog>
    </section>
  );
};
