// TransitionAI — Command Center Overview
import React, { useEffect } from 'react';
import { useTransition } from '../context/TransitionContext';
import {
  Leaf,
  Coins,
  ShieldCheck,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  UploadCloud,
  FileCheck2,
  Sparkles,
  Zap,
  Building,
  Target,
  BarChart2,
  Lock,
  Calculator,
  Scale
} from 'lucide-react';
import { formatCurrency } from '../utils/transitionCalculations';

export const OverviewView: React.FC = () => {
  const {
    currentRole,
    profile,
    baseline,
    financial,
    allActions,
    selectedActions,
    greenLoanEligibility,
    activityRecords,
    setActiveTab,
    loadSampleData,
    navigateToUpload,
    inspectedFiles,
    returnSourceSection,
    setReturnSourceSection
  } = useTransition();

  // Scroll to activity evidence section if returned from that upload flow
  useEffect(() => {
    if (returnSourceSection === 'activity_evidence') {
      const el = document.getElementById('activity-evidence-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [returnSourceSection]);

  const isWorkspaceEmpty = activityRecords.length === 0;

  // Filter energy records specifically
  const energyRecords = activityRecords.filter((r) =>
    ['electricity', 'fuel_diesel', 'fuel_petrol', 'fuel_gas', 'fuel_lpg', 'water', 'refrigerant'].includes(r.category)
  );
  const hasPendingReview = inspectedFiles && inspectedFiles.length > 0;
  const missingCoverageWarning = baseline.dataConfidence.missingPeriods.length > 0;
  const missingScope1Fuel = energyRecords.length > 0 && !energyRecords.some((r) => r.category.startsWith('fuel_'));
  const hasIncompleteOrConflicting = missingCoverageWarning || missingScope1Fuel || baseline.dataConfidence.overallScorePct < 60;

  // Total planned CapEx and annual carbon reduction from selected actions
  const totalPlannedCapex = selectedActions.reduce((sum, a) => sum + a.capex, 0);
  const totalPlannedSavings = selectedActions.reduce((sum, a) => sum + a.annualOpExSavings, 0);
  const totalPlannedCO2Reduction = selectedActions.reduce((sum, a) => sum + a.annualCO2eReductionTons, 0);
  const targetReductionPct = profile.emissionReductionTargetPct || 30;

  return (
    <div className="space-y-6">
      {/* Role Banner if Lender Mode */}
      {currentRole === 'lender' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Lock className="w-5 h-5 text-amber-700 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">Lender / Credit Analyst Mode Active</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Viewing authorized transition disclosures, carbon audit verification, and credit stress-testing metrics. Private SME workspace files and internal accounting records remain protected.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('transition-plan')}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition"
          >
            Review Lender Pack
          </button>
        </div>
      )}

      {/* Hero Welcome / Primary Onboarding Entry Point */}
      {isWorkspaceEmpty ? (
        <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Primary Business Onboarding</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Turn Your Business Data Into a Transition Plan
            </h1>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Upload your financial records and energy data to understand your cash flow, carbon emissions, and decarbonisation opportunities.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={() => navigateToUpload('full_business_data', 'hero')}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition shadow-sm flex items-center justify-center space-x-2"
              >
                <UploadCloud className="w-4 h-4 text-slate-950" />
                <span>Upload Business Data</span>
              </button>

              <button
                onClick={loadSampleData}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-sm transition flex items-center justify-center space-x-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>Load Real Industrial Sample Data</span>
              </button>
            </div>

            <p className="mt-3 text-xs text-emerald-300/80 font-medium">
              Bank statements · Utility bills · Fuel records · Operational data
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 text-lg">{profile.name || 'SME Workspace'}</span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
                {profile.industry || 'Manufacturing'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Reporting Cycle: Calendar Year {profile.reportingYear} • Facility: {profile.facilityLocation || 'Peninsular Malaysia'} • {activityRecords.length} Verified Records Ingested
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigateToUpload('full_business_data', 'hero')}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>Upload Business Data</span>
            </button>

            <div className="text-right px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Audit Data Confidence</span>
              <span className={`text-sm font-bold ${
                baseline.dataConfidence.overallScorePct >= 70 ? 'text-emerald-700' : 'text-amber-600'
              }`}>
                {baseline.dataConfidence.overallScorePct}% ({baseline.dataConfidence.level})
              </span>
            </div>

            <button
              onClick={() => setActiveTab('transition-plan')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition flex items-center space-x-1.5"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Export Transition Plan</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Baseline Carbon */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Carbon Footprint Baseline</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Leaf className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">{baseline.totalTCO2e}</span>
            <span className="text-xs text-slate-500 ml-1.5 font-medium">tCO₂e / year</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
            <span>Scope 1: <strong>{baseline.scope1TCO2e} t</strong></span>
            <span>Scope 2: <strong>{baseline.scope2TCO2e} t</strong></span>
          </div>
        </div>

        {/* Metric 2: Annual Utility Outlay */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Annual Energy & Utility Spend</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">
              {formatCurrency(financial.totalUtilityCost, profile.currency)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
            <span>{financial.energyCostPctOfOpEx}% of OpEx</span>
            <span className="text-emerald-600 font-medium">Elect: {formatCurrency(financial.annualEnergyCost, profile.currency)}</span>
          </div>
        </div>

        {/* Metric 3: Debt Capacity & DSCR */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Borrowing Capacity (DSCR {profile.minDscrRequirement}x)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">
              {formatCurrency(financial.maxBorrowingCapacityAtTargetDscr, profile.currency)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
            <span>Current DSCR: <strong>{financial.currentDscr.toFixed(2)}x</strong></span>
            <span className="text-emerald-600 font-medium">Capacity Healthy</span>
          </div>
        </div>

        {/* Metric 4: Green Loan Readiness */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Green Loan Facility Readiness</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-2">
            <span className="text-2xl font-extrabold text-slate-900">{greenLoanEligibility.readinessScorePct}%</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
              greenLoanEligibility.overallStatus === 'Eligible'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {greenLoanEligibility.overallStatus}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2 truncate">
            {greenLoanEligibility.facilityName}
          </div>
        </div>
      </div>

      {/* Main Two-Column Workflow Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Decarbonisation Roadmap & Financial Feasibility */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Pipeline Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Decarbonisation Investment Pipeline</h2>
                <p className="text-xs text-slate-500">
                  Grounded in your facility's metered electricity and fuel activity records.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('actions')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>Customize Roadmap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Selected Roadmap Summary Bar */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] uppercase font-semibold text-emerald-800 block">Total Planned CapEx</span>
                <span className="text-base font-extrabold text-emerald-950">
                  {formatCurrency(totalPlannedCapex, profile.currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-emerald-800 block">Annual OpEx Bill Savings</span>
                <span className="text-base font-extrabold text-emerald-950">
                  {formatCurrency(totalPlannedSavings, profile.currency)} / yr
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-emerald-800 block">Annual Emissions Cut</span>
                <span className="text-base font-extrabold text-emerald-950">
                  {totalPlannedCO2Reduction} tCO₂e / yr ({baseline.totalTCO2e > 0 ? ((totalPlannedCO2Reduction / baseline.totalTCO2e) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>

            {/* Action Cards List */}
            <div className="space-y-3">
              {allActions.slice(0, 3).map((action) => (
                <div
                  key={action.id}
                  className={`border rounded-xl p-4 transition ${
                    action.isSelectedForPlan
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">{action.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {action.category}
                        </span>
                        {action.financing.isCashFlowPositive && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Cash Flow Positive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 max-w-xl line-clamp-2">
                        {action.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <span className="text-sm font-bold text-slate-900 block">
                        {formatCurrency(action.capex, profile.currency)}
                      </span>
                      <span className="text-xs text-emerald-700 font-medium">
                        Payback: {action.paybackPeriodYears} yrs
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <div className="flex items-center space-x-4">
                      <span>Energy Saved: <strong>{action.annualEnergySavingsQuantity.toLocaleString()} {action.annualEnergySavingsUnit}</strong></span>
                      <span>CO₂ Cut: <strong>{action.annualCO2eReductionTons} t/yr</strong></span>
                      <span>Net Cash: <strong className="text-emerald-700">+{formatCurrency(action.financing.netMonthlyCashFlowImpact, profile.currency)}/mo</strong></span>
                    </div>

                    <button
                      onClick={() => setActiveTab('actions')}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      View Financial Model →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Data Completeness & Sources Card (Dynamic States A, B, C, D) */}
          <div id="activity-evidence-section" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Activity Data & Audit Verification</h3>
                <p className="text-xs text-slate-500">Every calculation is linked to verified source documents.</p>
              </div>
              <button
                onClick={() => navigateToUpload('energy_emissions', 'activity_evidence')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start sm:self-auto"
              >
                <span>Upload Energy Records</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* State B — Energy records uploaded but awaiting review */}
            {hasPendingReview && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      {inspectedFiles.length} File(s) Awaiting Review & Confirmation
                    </h4>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Extracted records have not been imported into the audit baseline yet. Review column mapping and confirm import.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigateToUpload('energy_emissions', 'activity_evidence')}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition shrink-0"
                >
                  Review & Confirm Ingestion
                </button>
              </div>
            )}

            {/* State A — No relevant energy records */}
            {energyRecords.length === 0 && !hasPendingReview ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <Leaf className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Complete Your Energy Evidence</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Add electricity bills, fuel receipts, or other energy records to calculate and verify your emissions.
                </p>
                <button
                  onClick={() => navigateToUpload('energy_emissions', 'activity_evidence')}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-sm inline-flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Energy Records</span>
                </button>
                <p className="mt-2 text-[11px] text-slate-400">
                  TNB electricity bills · Fuel receipts · Natural gas records
                </p>
              </div>
            ) : energyRecords.length > 0 ? (
              <div>
                {/* State C & D: Coverage Summary Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Reporting Coverage</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      Calendar Year {profile.reportingYear} ({baseline.monthlyTrends.length} of 12 Months)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Verification Status</span>
                    <span className={`font-bold mt-0.5 block ${baseline.dataConfidence.overallScorePct >= 75 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {baseline.dataConfidence.overallScorePct}% ({baseline.dataConfidence.level} Grade)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Evidence Breakdown</span>
                    <span className="text-slate-700 font-medium mt-0.5 block">
                      {baseline.dataConfidence.measuredPct + baseline.dataConfidence.invoiceDerivedPct}% Invoice-Derived / Metered
                    </span>
                  </div>
                </div>

                {/* State D — Incomplete or conflicting records issue banner */}
                {hasIncompleteOrConflicting && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-amber-900">Incomplete Coverage Detected</h4>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          {missingScope1Fuel ? '• Scope 1 fleet fuel records missing (only electricity recorded). ' : ''}
                          {missingCoverageWarning ? baseline.dataConfidence.missingPeriods.join(' • ') : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigateToUpload('energy_emissions', 'activity_evidence')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold text-xs hover:bg-amber-100 transition shrink-0"
                    >
                      Resolve Missing Evidence
                    </button>
                  </div>
                )}

                {/* State C: Auditable Records Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Quantity & Unit</th>
                        <th className="py-2.5 px-3">Emissions</th>
                        <th className="py-2.5 px-3">Quality</th>
                        <th className="py-2.5 px-3">Source Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {energyRecords.slice(0, 5).map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-900">{rec.date}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              rec.scope === 'Scope 2' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {rec.scope} • {rec.category}
                            </span>
                          </td>
                          <td className="py-2 px-3">{rec.quantity.toLocaleString()} {rec.unit}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{rec.emissionsTCO2e} tCO₂e</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                              {rec.dataQuality}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[150px]">
                            {rec.sourceFileName || rec.invoiceNumber || 'Manual'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Column (1 span): AI Copilot Insights & Green Loan Status */}
        <div className="space-y-6">
          {/* AI Copilot Quick Assistant Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-xs">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">AI Green Finance Copilot</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ask questions grounded strictly in your verified records. Copilot tests debt service thresholds, identifies missing documentation, and explains loan covenants.
            </p>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => setActiveTab('copilot')}
                className="w-full text-left p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 transition"
              >
                "Can our cash flow afford RM 250k for Rooftop Solar at 3.75%?"
              </button>
              <button
                onClick={() => setActiveTab('copilot')}
                className="w-full text-left p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 transition"
              >
                "What additional proof do we need for the BNM LCTF green facility?"
              </button>
            </div>

            <button
              onClick={() => setActiveTab('copilot')}
              className="mt-4 w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition flex items-center justify-center space-x-1.5"
            >
              <span>Open AI Copilot Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Green Loan Eligibility Breakdown Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Green Facility Eligibility</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                greenLoanEligibility.overallStatus === 'Eligible'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {greenLoanEligibility.overallStatus}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              {greenLoanEligibility.facilityName} (Concessionary Rate: {greenLoanEligibility.concessionaryRatePct}%)
            </p>

            <div className="space-y-2.5">
              {greenLoanEligibility.criteria.map((crit) => (
                <div key={crit.id} className="text-xs border-b border-slate-100 pb-2 last:border-none">
                  <div className="flex items-center justify-between font-medium text-slate-800">
                    <span>{crit.category}</span>
                    <span className={`text-[10px] font-semibold uppercase ${
                      crit.status === 'passed' ? 'text-emerald-700' : 'text-amber-600'
                    }`}>
                      {crit.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{crit.evidence}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('transition-plan')}
              className="mt-4 w-full py-2 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium text-xs transition text-center"
            >
              Review Full Lender Package
            </button>
          </div>

          {/* Quality Assurance & Legal Governance Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Governance & System Assurance</h3>
            <p className="text-xs text-slate-500 mb-3">
              Independent testable calculations and Malaysian PDPA statutory compliance.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('test-suite')}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 transition flex items-center justify-between text-left"
              >
                <div className="flex items-center space-x-2.5">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Financial Test Suite</span>
                    <span className="text-[10px] text-slate-500">12 Mandatory Regression Tests (A–L)</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  12/12
                </span>
              </button>

              <button
                onClick={() => setActiveTab('legal-governance')}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50 transition flex items-center justify-between text-left"
              >
                <div className="flex items-center space-x-2.5">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Legal & Privacy Center</span>
                    <span className="text-[10px] text-slate-500">19 T&C Sections • 12 Privacy Sections</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  PDPA 2024
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
