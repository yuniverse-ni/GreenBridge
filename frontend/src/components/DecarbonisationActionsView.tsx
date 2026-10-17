// TransitionAI — Decarbonisation Actions & Green Financing Modeler
import React, { useState } from 'react';
import { useTransition } from '../context/TransitionContext';
import { DecarbonisationAction } from '../types/transition';
import { formatCurrency } from '../utils/transitionCalculations';
import {
  Lightbulb,
  CheckCircle2,
  Coins,
  Leaf,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

export const DecarbonisationActionsView: React.FC = () => {
  const { allActions, selectedActionIds, toggleAction, profile, baseline, financial } = useTransition();

  const [expandedActionId, setExpandedActionId] = useState<string | null>(allActions[0]?.id || null);

  const selectedActions = allActions.filter((a) => selectedActionIds.includes(a.id));
  const totalPlannedCapex = selectedActions.reduce((s, a) => s + a.capex, 0);
  const totalPlannedSavings = selectedActions.reduce((s, a) => s + a.annualOpExSavings, 0);
  const totalPlannedCO2 = selectedActions.reduce((s, a) => s + a.annualCO2eReductionTons, 0);
  const totalPlannedMonthlyRepayment = selectedActions.reduce((s, a) => s + a.financing.monthlyRepayment, 0);
  const totalPlannedMonthlySavings = Math.round(totalPlannedSavings / 12);
  const netMonthlyBenefit = totalPlannedMonthlySavings - totalPlannedMonthlyRepayment;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Decarbonisation Interventions & Green Financing</h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              Sized to Real Energy Spend
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            SME-tailored clean technology interventions calculated from your metered electricity and fuel activity. Compare payback, Net Present Value (NPV), and concessionary green loan affordability.
          </p>
        </div>

        {/* Selected Roadmap Pill */}
        <div className="flex items-center space-x-3 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-800 block">Selected in Plan</span>
            <span className="text-sm font-extrabold text-emerald-950">
              {selectedActionIds.length} of {allActions.length} Actions
            </span>
          </div>
          <div className="text-right pl-3 border-l border-emerald-200">
            <span className="text-[10px] font-bold uppercase text-emerald-800 block">Net Monthly Benefit</span>
            <span className="text-sm font-extrabold text-emerald-700">
              +{formatCurrency(netMonthlyBenefit, profile.currency)} / mo
            </span>
          </div>
        </div>
      </div>

      {/* Roadmap Portfolio Summary Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300 mb-1">
          Active Decarbonisation Roadmap Portfolio
        </h3>
        <p className="text-xs text-slate-300 mb-5">
          Simulated impact if all checked interventions are financed via a concessionary green loan facility.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3 bg-white/10 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">Total Investment CapEx</span>
            <span className="text-xl font-extrabold text-white mt-1 block">
              {formatCurrency(totalPlannedCapex, profile.currency)}
            </span>
            <span className="text-[10px] text-emerald-300 mt-1 block">100% Green Loan Eligible</span>
          </div>

          <div className="p-3 bg-white/10 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">Annual OpEx Bill Savings</span>
            <span className="text-xl font-extrabold text-white mt-1 block">
              {formatCurrency(totalPlannedSavings, profile.currency)} / yr
            </span>
            <span className="text-[10px] text-emerald-300 mt-1 block">Cuts ongoing utility overhead</span>
          </div>

          <div className="p-3 bg-white/10 rounded-xl border border-white/10">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">Emissions Abatement</span>
            <span className="text-xl font-extrabold text-white mt-1 block">
              {totalPlannedCO2} tCO₂e / yr
            </span>
            <span className="text-[10px] text-emerald-300 mt-1 block">
              {baseline.totalTCO2e > 0 ? ((totalPlannedCO2 / baseline.totalTCO2e) * 100).toFixed(0) : 0}% of baseline
            </span>
          </div>

          <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
            <span className="text-[10px] uppercase font-bold text-emerald-200 block">Net Monthly Cash Flow</span>
            <span className="text-xl font-extrabold text-emerald-300 mt-1 block">
              +{formatCurrency(netMonthlyBenefit, profile.currency)} / mo
            </span>
            <span className="text-[10px] text-emerald-200 mt-1 block">Energy Savings &gt; Loan Payment</span>
          </div>
        </div>
      </div>

      {/* Decarbonisation Actions Catalog */}
      <div className="space-y-4">
        {allActions.map((action) => {
          const isSelected = selectedActionIds.includes(action.id);
          const isExpanded = expandedActionId === action.id;

          return (
            <div
              key={action.id}
              className={`bg-white border rounded-2xl transition shadow-xs overflow-hidden ${
                isSelected ? 'border-emerald-300 ring-1 ring-emerald-400/30' : 'border-slate-200'
              }`}
            >
              {/* Card Header & Primary Stats */}
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  {/* Select Checkbox */}
                  <button
                    onClick={() => toggleAction(action.id)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-1 transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'border-2 border-slate-300 hover:border-emerald-500'
                    }`}
                    title={isSelected ? 'Remove from official roadmap' : 'Include in official roadmap'}
                  >
                    {isSelected && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{action.title}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {action.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        action.scopeTarget === 'Scope 2' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {action.scopeTarget}
                      </span>
                      {action.financing.isCashFlowPositive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Cash Flow Positive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl">{action.description}</p>
                  </div>
                </div>

                {/* Right Quick Metrics & Actions */}
                <div className="flex items-center space-x-6 shrink-0 justify-between md:justify-end border-t md:border-none pt-3 md:pt-0 border-slate-100">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Upfront CapEx</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {formatCurrency(action.capex, profile.currency)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Annual Bill Savings</span>
                    <span className="text-base font-extrabold text-emerald-700">
                      {formatCurrency(action.annualOpExSavings, profile.currency)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Payback</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {action.paybackPeriodYears} yrs
                    </span>
                  </div>

                  <button
                    onClick={() => setExpandedActionId(isExpanded ? null : action.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    {isExpanded ? 'Collapse' : 'Details & Financing'}
                  </button>
                </div>
              </div>

              {/* Expanded Financing & Technical Deep-Dive */}
              {isExpanded && (
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
                          +{formatCurrency(action.financing.netMonthlyCashFlowImpact, profile.currency)} / mo
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">10-Year NPV</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                          {formatCurrency(action.tenYearNpv, profile.currency)}
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">CO₂ Abatement Cost</span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                          {action.marginalAbatementCost} / tCO₂e
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
