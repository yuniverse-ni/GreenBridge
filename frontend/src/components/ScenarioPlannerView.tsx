import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatMYR } from '../utils/financeCalculations';
import {
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Sliders,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Info,
  Calendar,
  Layers,
  Check
} from 'lucide-react';

export const ScenarioPlannerView: React.FC = () => {
  const {
    candidatePlans,
    selectedPlanId,
    setSelectedPlanId,
    planACollectionDay,
    setPlanACollectionDay,
    planBExtensionDays,
    setPlanBExtensionDays,
    planCCutSen,
    setPlanCCutSen,
    setActiveTab,
    businessProfile,
    geminiActive
  } = useFinance();

  const [aiAnalysis, setAiAnalysis] = useState<{
    headline?: string;
    details?: string;
    planAAdvantage?: string;
    planBWarning?: string;
    contingency?: string;
    loading: boolean;
  }>({
    loading: false
  });

  const requestAiAnalysis = async () => {
    setAiAnalysis((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/ai/explain-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: candidatePlans })
      });
      const data = await res.json();
      setAiAnalysis({
        headline: data.recommendationHeadline,
        details: data.strategicAnalysis,
        planAAdvantage: data.planAAdvantage,
        planBWarning: data.planBWarning,
        contingency: data.contingencyPlan,
        loading: false
      });
    } catch {
      const planA = candidatePlans.find((p) => p.id === 'PLAN_A') || candidatePlans[0];
      setAiAnalysis({
        headline: `${planA ? planA.code : 'Plan A'} provides optimal cash stability for your current commitments.`,
        details: planA ? planA.strategySummary : 'Prioritizing customer collection solves liquidity deficits without supplier friction.',
        planAAdvantage: 'Preserves vendor relationships and recovers earned revenue promptly.',
        planBWarning: 'Supplier extensions defer liabilities but do not inject new cash into operating accounts.',
        contingency: 'Combine partial receipts with selective discretionary expense curbs if full settlement is delayed.',
        loading: false
      });
    }
  };

  if (candidatePlans.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-2xl mx-auto my-8 shadow-xs">
        <Sliders className="w-12 h-12 text-teal-700 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">No Recovery Scenarios Needed Yet</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Upload your financial records (supplier bills and customer invoices) to evaluate recovery options and compare scenario plans.
        </p>
        <button
          onClick={() => setActiveTab('data-setup')}
          className="mt-5 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-semibold transition"
        >
          Go to Upload & Setup
        </button>
      </div>
    );
  }

  const selectedPlan = candidatePlans.find((p) => p.id === selectedPlanId) || candidatePlans[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Scenario Planner & Recovery Engine
            </h1>
            <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded font-semibold">
              Signature Innovation
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Simulate and compare deterministic financial recovery strategies before taking action.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('actions')}
          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-2 self-start md:self-auto shadow-xs"
        >
          <span>Review Recommended Plan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Assumption Adjusters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-teal-700" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Live Scenario Simulation Controls
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Deterministic Recalculation Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Slider 1: Plan A Expected Collection Date */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Plan A: INV-1042 Collection Day</span>
              <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Day {planACollectionDay}
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Assumed settlement arrival date (Bills fall due on Day 10).
            </p>
            <input
              type="range"
              min={1}
              max={15}
              value={planACollectionDay}
              onChange={(e) => setPlanACollectionDay(Number(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Day 1 (Urgent)</span>
              <span>Day 10 (Deadline)</span>
              <span>Day 15 (Too late)</span>
            </div>
          </div>

          {/* Slider 2: Plan B Supplier Extension */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Plan B: Supplier Term Extension</span>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                +{planBExtensionDays} Days
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Postpone TechSupply BILL-201 (RM 15k) to Day {10 + planBExtensionDays}.
            </p>
            <input
              type="range"
              min={7}
              max={30}
              step={7}
              value={planBExtensionDays}
              onChange={(e) => setPlanBExtensionDays(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>+7 Days</span>
              <span>+14 Days</span>
              <span>+30 Days</span>
            </div>
          </div>

          {/* Slider 3: Plan C Discretionary Expense Reduction */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Plan C: Discretionary Cut</span>
              <span className="font-mono font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                {formatMYR(planCCutSen)}
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Pause non-essential SaaS and marketing expenses.
            </p>
            <input
              type="range"
              min={50000}
              max={300000}
              step={25000}
              value={planCCutSen}
              onChange={(e) => setPlanCCutSen(Number(e.target.value))}
              className="w-full accent-slate-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>RM 500</span>
              <span>RM 1,500</span>
              <span>RM 3,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side 3 Candidate Plans Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {candidatePlans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isPlanARecommended = plan.id === 'PLAN_A';

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                isSelected
                  ? 'border-teal-700 ring-2 ring-teal-600/30 shadow-md bg-white'
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Card Top Banner */}
              <div className={`p-5 border-b ${
                isPlanARecommended
                  ? 'bg-linear-to-r from-teal-50 to-slate-50 border-teal-100'
                  : 'bg-slate-50/70 border-slate-100'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">{plan.code}</span>
                    {isPlanARecommended && (
                      <span className="bg-teal-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    isSelected
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mt-2">
                  {plan.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                  {plan.strategySummary}
                </p>
              </div>

              {/* Card Metrics Grid */}
              <div className="p-5 space-y-4 text-xs flex-1">
                {/* Metric 1: Lowest Projected Cash */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Lowest Cash Balance:</span>
                  <div className="text-right">
                    <span className={`font-mono font-bold text-sm ${
                      plan.lowestBalanceSen < 0
                        ? 'text-rose-700'
                        : plan.lowestBalanceSen < businessProfile.minReserveSen
                        ? 'text-amber-700'
                        : 'text-teal-800'
                    }`}>
                      {formatMYR(plan.lowestBalanceSen)}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      on Day {plan.lowestBalanceDay}
                    </span>
                  </div>
                </div>

                {/* Metric 2: Minimum Reserve Breach */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Reserve Breach:</span>
                  <div>
                    {plan.reserveBreachSen === 0 ? (
                      <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>RM 0 (100% Preserved)</span>
                      </span>
                    ) : (
                      <span className="text-rose-700 font-semibold flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>-{formatMYR(plan.reserveBreachSen)} Deficit</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric 3: Financial Impact */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Direct Financial Impact:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    +{formatMYR(plan.financialImpactSen)}
                  </span>
                </div>

                {/* Metric 4: Operational Risk */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Operational Risk:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                      plan.operationalRisk === 'Low'
                        ? 'bg-emerald-100 text-emerald-800'
                        : plan.operationalRisk === 'Medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {plan.operationalRisk} Risk
                  </span>
                </div>

                {/* Assumptions */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold text-slate-700 block">
                    Underlying Assumptions:
                  </span>
                  {plan.assumptions.map((assump, idx) => (
                    <div key={idx} className="text-[11px] text-slate-500 flex items-start space-x-1.5">
                      <span className="text-slate-400 mt-0.5">•</span>
                      <span>{assump}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer Selection Button */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {plan.actions.length} action(s) prepared
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanId(plan.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-teal-700 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isSelected ? 'Active Selection' : 'Select Plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Comparative Insights Panel */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/40">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                AI Strategic Evaluation & Ranking
              </h3>
              <p className="text-xs text-slate-300">
                Evaluating candidate trade-offs for Malaysian business reality
              </p>
            </div>
          </div>

          <button
            onClick={requestAiAnalysis}
            disabled={aiAnalysis.loading}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiAnalysis.loading ? 'Consulting Gemini...' : 'Analyze Trade-Offs'}</span>
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs leading-relaxed">
          <p className="font-semibold text-teal-300 text-sm">
            {aiAnalysis.headline ||
              'Plan A is strongly recommended: Solves 100% of the cash shortfall without incurring supplier friction.'}
          </p>
          <p className="text-slate-200">
            {aiAnalysis.details ||
              'Plan A attacks the root cause: RM 12,000 locked in overdue receivables from MegaRetail. Once settled before Day 10, cash reserves absorb all RM 25,000 in scheduled obligations while keeping RM 5,000 in safety reserve completely intact.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-700/80">
            <div className="bg-white/5 p-3 rounded-lg border border-white/10">
              <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block">
                Plan A Decisive Advantage
              </span>
              <p className="text-slate-300 mt-1">
                {aiAnalysis.planAAdvantage ||
                  'Maintains pristine commercial credit terms and vendor discounts without altering supplier payment dates.'}
              </p>
            </div>

            <div className="bg-white/5 p-3 rounded-lg border border-white/10">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                Plan B Hidden Risk
              </span>
              <p className="text-slate-300 mt-1">
                {aiAnalysis.planBWarning ||
                  'Postponing TechSupply leaves your bank balance at RM 500 on Day 12, breaching reserve and creating service disruption exposure.'}
              </p>
            </div>

            <div className="bg-white/5 p-3 rounded-lg border border-white/10">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Contingency Trigger
              </span>
              <p className="text-slate-300 mt-1">
                {aiAnalysis.contingency ||
                  'If MegaRetail can only process 50% this week, activate Plan C immediately and freeze RM 1,500 in non-urgent SaaS.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
