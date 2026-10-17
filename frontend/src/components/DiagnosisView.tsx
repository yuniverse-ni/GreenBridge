import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatMYR } from '../utils/financeCalculations';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Link as LinkIcon,
  ShieldAlert,
  Building,
  CreditCard,
  FileText,
  ChevronRight,
  TrendingDown
} from 'lucide-react';

export const DiagnosisView: React.FC = () => {
  const {
    businessProfile,
    invoices,
    bills,
    currentAlert,
    setActiveTab,
    geminiActive,
    hasSimulatedPayment
  } = useFinance();

  const overdueInvoices = invoices.filter((i) => i.status === 'overdue' || i.daysOverdue > 0);
  const unpaidBills = bills.filter((b) => b.status !== 'paid');
  const totalBillsSen = unpaidBills.reduce((acc, b) => acc + b.amountSen, 0);
  const totalOverdueSen = overdueInvoices.reduce((acc, i) => acc + i.amountSen, 0);

  const [aiDiagnosis, setAiDiagnosis] = useState<{
    summary?: string;
    whyItMatters?: string;
    immediateStep?: string;
    tone?: string;
    loading: boolean;
  }>({
    loading: false
  });

  const requestAiDiagnosis = async () => {
    setAiDiagnosis((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessProfile.name || 'Your Company',
          currentCash: formatMYR(businessProfile.initialCashSen, false),
          minReserve: formatMYR(businessProfile.minReserveSen, false),
          bills: formatMYR(totalBillsSen, false),
          overdueInvoices: formatMYR(totalOverdueSen, false),
          deficit: formatMYR(currentAlert.reserveDeficitSen, false)
        })
      });
      const data = await res.json();
      setAiDiagnosis({
        summary: data.summary,
        whyItMatters: data.whyItMatters,
        immediateStep: data.immediateStep,
        tone: data.tone,
        loading: false
      });
    } catch {
      setAiDiagnosis({
        summary: currentAlert.shortDescription || 'A timing discrepancy between scheduled payables and expected receipts risks depleting your safety reserve.',
        whyItMatters: currentAlert.rootCause || `Upcoming vendor payables of ${formatMYR(totalBillsSen)} mature before uncollected receivables (${formatMYR(totalOverdueSen)}) are received.`,
        immediateStep: currentAlert.recommendedActionSummary || 'Authorize an invoice follow-up or negotiate term extensions on upcoming bills.',
        tone: 'Deterministic Rules Engine fallback',
        loading: false
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Cash Risk Diagnosis
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
              Root-Cause Analysis
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Why does the cash deficit happen, what records drove it, and what are the verifiable facts?
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => setActiveTab('scenarios')}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-2 self-start md:self-auto shadow-xs"
        >
          <span>Explore Solutions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* AI Plain Language Reasoning Panel */}
      <div className="bg-linear-to-r from-teal-50 via-slate-50 to-white rounded-xl border border-teal-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                AI Copilot Plain-Language Diagnosis
              </h3>
              <p className="text-[11px] text-slate-500">
                Powered by {geminiActive ? 'Gemini 3.8 Flash' : 'Financial Rules Engine'}
              </p>
            </div>
          </div>

          <button
            onClick={requestAiDiagnosis}
            disabled={aiDiagnosis.loading}
            className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiDiagnosis.loading ? 'Reasoning with Gemini...' : 'Generate AI Diagnosis'}</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-3.5 rounded-lg border border-teal-100/80 shadow-2xs">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider text-teal-800">
              The Root Cause
            </span>
            <p className="text-slate-600 mt-1 leading-relaxed">
              {aiDiagnosis.summary || currentAlert.rootCause || 'Scheduled vendor commitments exceed available bank cash before incoming receivables are settled.'}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-teal-100/80 shadow-2xs">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider text-teal-800">
              Why This Matters
            </span>
            <p className="text-slate-600 mt-1 leading-relaxed">
              {aiDiagnosis.whyItMatters || (currentAlert.lowestBalanceSen < businessProfile.minReserveSen ? `Cash drops to ${formatMYR(currentAlert.lowestBalanceSen)}, breaching your ${formatMYR(businessProfile.minReserveSen)} safety reserve by ${formatMYR(currentAlert.reserveDeficitSen)}.` : 'Liquidity stays within your safety buffer throughout the forecast horizon.')}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-teal-100/80 shadow-2xs">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider text-teal-800">
              What You Can Do Next
            </span>
            <p className="text-slate-600 mt-1 leading-relaxed">
              {aiDiagnosis.immediateStep || currentAlert.recommendedActionSummary || 'Review candidate recovery plans in the Scenario Planner to accelerate collections or defer payables.'}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Core Groups of Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Group 1: Confirmed Facts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                1. Confirmed Facts
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified balances and contractual payment deadlines
            </p>
          </div>

          <div className="p-4 space-y-3 flex-1 text-xs">
            {/* Fact 1: Opening Bank Balance */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{businessProfile.bankName || 'Cleared Bank Balance'}</span>
                <span className="font-mono font-bold text-teal-800">
                  {formatMYR(businessProfile.initialCashSen)}
                </span>
              </div>
              <p className="text-slate-500 mt-1 text-[11px]">
                {businessProfile.accountNumberMasked ? `Account ${businessProfile.accountNumberMasked} verified.` : 'Operating cash position in Malaysian Ringgit (MYR).'}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center text-[10px] text-teal-700 font-medium">
                <LinkIcon className="w-3 h-3 mr-1" />
                <span>Source: Electronic Bank Statement / Uploaded Balance</span>
              </div>
            </div>

            {/* Fact 2 & onwards: Real Uploaded Bills */}
            {bills.length > 0 ? (
              bills.slice(0, 3).map((bill) => (
                <div key={bill.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{bill.vendorName}</span>
                    <span className="font-mono font-bold text-rose-700">-{formatMYR(bill.amountSen)}</span>
                  </div>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    Due in {bill.dueDayOffset} days ({bill.dueDate}). {bill.description || 'Vendor invoice payable'}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-center text-[10px] text-teal-700 font-medium">
                    <LinkIcon className="w-3 h-3 mr-1" />
                    <span>Source: {bill.sourceFileName || `Bill #${bill.id}`}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                No supplier payables on record.
              </div>
            )}
          </div>
        </div>

        {/* Group 2: Uncertain Events */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-amber-50/40 rounded-t-xl">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm">
                2. Uncertain Events
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Future customer payments not yet confirmed in bank
            </p>
          </div>

          <div className="p-4 space-y-3 flex-1 text-xs">
            {invoices.length > 0 ? (
              invoices.slice(0, 3).map((inv) => (
                <div key={inv.id} className={`p-3 rounded-lg border ${
                  inv.status === 'overdue' || inv.daysOverdue > 0
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{inv.customerName}</span>
                    <span className="font-mono font-bold text-amber-700">+{formatMYR(inv.amountSen)}</span>
                  </div>
                  <p className="text-slate-600 mt-1 text-[11px]">
                    {inv.status === 'paid' ? (
                      <span className="text-emerald-700 font-medium">Payment reconciled and confirmed.</span>
                    ) : inv.daysOverdue > 0 ? (
                      <strong>{inv.daysOverdue} Days Overdue (Matured {inv.dueDate})</strong>
                    ) : (
                      `Due: ${inv.dueDate} (Within payment terms)`
                    )}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                    <span className={`font-semibold flex items-center ${
                      inv.status === 'paid' ? 'text-emerald-700' : inv.daysOverdue > 0 ? 'text-amber-800' : 'text-slate-500'
                    }`}>
                      {inv.status === 'paid' ? 'Reconciled' : inv.daysOverdue > 0 ? 'Collection Priority: High' : 'Status: Pending'}
                    </span>
                    <span className="text-slate-500 font-mono">{inv.id}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                No customer receivables on record.
              </div>
            )}

            {/* AI Warning Box */}
            <div className="p-3 bg-slate-100 rounded-lg text-slate-600 text-[11px] leading-relaxed">
              <strong>Prudent Finance Rule:</strong> CashPilot never treats unconfirmed receivables or payment promises as confirmed liquidity until officially received.
            </div>
          </div>
        </div>

        {/* Group 3: Available Options */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50/40 rounded-t-xl">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                3. Available Options
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Actionable recovery levers ready for evaluation
            </p>
          </div>

          <div className="p-4 space-y-3 flex-1 text-xs">
            {/* Option A: Overdue Invoice Collection */}
            <div className="p-3 bg-emerald-50/30 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Overdue Invoice Collection</span>
                <span className="font-mono font-bold text-emerald-700">
                  {overdueInvoices.length > 0 ? `+${formatMYR(overdueInvoices[0].amountSen)}` : '+MYR 0.00'}
                </span>
              </div>
              <p className="text-slate-600 mt-1 text-[11px]">
                {overdueInvoices.length > 0
                  ? `Dispatch formal reminder for invoice ${overdueInvoices[0].id} to ${overdueInvoices[0].customerName}.`
                  : 'Follow up on upcoming receivables prior to maturity.'}
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center justify-between text-[10px] text-emerald-800 font-medium">
                <span>Feasibility: High (Primary Lever)</span>
                <span>Impact: Earned Revenue</span>
              </div>
            </div>

            {/* Option B: Vendor Term Extension */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Supplier Extension Negotiation</span>
                <span className="font-mono font-bold text-slate-700">
                  {unpaidBills.length > 0 ? `Defer ${formatMYR(unpaidBills[0].amountSen)}` : 'Term Extension'}
                </span>
              </div>
              <p className="text-slate-500 mt-1 text-[11px]">
                {unpaidBills.length > 0
                  ? `Request ${unpaidBills[0].vendorName} to postpone bill ${unpaidBills[0].id} by 14 days.`
                  : 'Negotiate deferred terms with key suppliers.'}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-amber-700 font-medium">
                <span>Feasibility: Medium</span>
                <span>Commercial Risk: Medium</span>
              </div>
            </div>

            {/* Option C: Discretionary Cut */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Discretionary OPEX Freeze</span>
                <span className="font-mono font-bold text-slate-700">Save RM 1,000+</span>
              </div>
              <p className="text-slate-500 mt-1 text-[11px]">
                Temporarily pause discretionary subscriptions and non-urgent supplier purchases.
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600 font-medium">
                <span>Feasibility: High</span>
                <span>Contingency Buffer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
