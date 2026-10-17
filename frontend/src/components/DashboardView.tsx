import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatMYR } from '../utils/financeCalculations';
import { ForecastChart } from './ForecastChart';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  HelpCircle,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
  Upload
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    businessProfile,
    invoices,
    bills,
    forecast,
    currentAlert,
    setActiveTab,
    hasSimulatedPayment,
    proposedActions,
    simulateCustomerPayment,
    isSimulatingPayment
  } = useFinance();

  const isHealthy = currentAlert.severity === 'healthy';

  // Calculate totals
  const availableCashSen = businessProfile.initialCashSen;
  const upcomingBillsSen = bills.filter((b) => b.status !== 'paid').reduce((acc, b) => acc + b.amountSen, 0);
  const outstandingReceivablesSen = invoices.filter((i) => i.status !== 'paid').reduce((acc, i) => acc + i.amountSen, 0);
  const overdueReceivablesSen = invoices.filter((i) => i.status === 'overdue' || i.daysOverdue > 0).reduce((acc, i) => acc + i.amountSen, 0);

  // Lowest projected cash balance in forecast
  const lowestBalanceSen = currentAlert.lowestBalanceSen;
  const minReserveSen = businessProfile.minReserveSen;

  const isDataAvailable = bills.length > 0 || invoices.length > 0 || availableCashSen > 0 || businessProfile.isConfigured;
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue' || i.daysOverdue > 0);
  const firstOverdue = overdueInvoices[0] || invoices.find((i) => i.status !== 'paid');

  if (!isDataAvailable) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs text-center max-w-3xl mx-auto my-6">
          <div className="w-16 h-16 bg-teal-50 text-teal-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-200">
            <Wallet className="w-8 h-8" />
          </div>
          <span className="text-xs font-semibold bg-teal-50 text-teal-800 px-3 py-1 rounded-full border border-teal-200 uppercase tracking-wider">
            SME Finance Copilot
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3">
            Know Your Cash. Control Your Next Move.
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto leading-relaxed">
            Upload your company's actual bank statements, invoices, or payables. CashPilot analyzes your real data, anticipates cash shortages, and prepares authorized recovery actions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">1. Multi-File Ingestion</span>
              <p className="text-xs text-slate-600">Upload CSV, Excel (.xlsx, .xls), or PDF statements, invoices, and supplier bills.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">2. Map & Validate</span>
              <p className="text-xs text-slate-600">Inspect extracted columns, review amounts in MYR, and flag duplicate or missing records.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">3. Automated Forecast</span>
              <p className="text-xs text-slate-600">View 30-day deterministic projections and evaluate AI-prepared recovery options.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setActiveTab('data-setup')}
              className="w-full sm:w-auto px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center justify-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Financial Records</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('data-setup')}
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-sm font-semibold transition"
            >
              <span>Download Starter CSV Templates</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Greeting, Business Name, Agent Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Good day, {businessProfile.name || 'Business Owner'}
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
              SME Cash Command Center
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time liquidity surveillance across 30 days. All figures verified in Malaysian Ringgit (MYR).
          </p>
        </div>

        {/* AI Copilot Status Card */}
        <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 flex items-center space-x-1.5">
              <span>Agent Status:</span>
              <span className={isHealthy ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                {isHealthy ? 'Active & Safe' : '1 Urgent Risk Identified'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isHealthy
                ? 'All obligations covered through the 30-day forecast horizon.'
                : 'Prepared 1 high-priority recovery plan with automated follow-up.'}
            </p>
          </div>
        </div>
      </div>

      {/* Prominent CashPilot Alert Section */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isHealthy
            ? 'bg-linear-to-r from-emerald-50 via-teal-50 to-white border-emerald-200'
            : 'bg-linear-to-r from-rose-50 via-amber-50/40 to-white border-rose-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isHealthy
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-rose-600 text-white shadow-xs animate-bounce'
              }`}
            >
              {isHealthy ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md ${
                    isHealthy
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800 font-bold'
                  }`}
                >
                  {isHealthy ? 'Cash Buffer Intact' : 'CashPilot Alert: Critical Shortage'}
                </span>
                <span className="text-xs text-slate-500">
                  Target Reserve: {formatMYR(minReserveSen)}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                {currentAlert.title}: {currentAlert.shortDescription}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                {currentAlert.rootCause}
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            {!isHealthy ? (
              <>
                <button
                  onClick={() => setActiveTab('diagnosis')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-medium text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
                >
                  <span>Review Cash Risk</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTab('scenarios')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-medium text-xs sm:text-sm rounded-xl transition flex items-center justify-center space-x-1"
                >
                  <span>Explore Solutions</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTab('audit')}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <span>View Full Audit Trail</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Settlement simulation banner for testing */}
        {!hasSimulatedPayment && firstOverdue && (
          <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
            <span className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>
                <strong>Simulation Sandbox:</strong> Test recovery impact by simulating settlement of invoice {firstOverdue.id} ({formatMYR(firstOverdue.amountSen)}) from {firstOverdue.customerName}.
              </span>
            </span>
            <button
              onClick={() => simulateCustomerPayment(firstOverdue.id)}
              disabled={isSimulatingPayment}
              className="text-teal-800 font-semibold hover:text-teal-900 underline flex items-center space-x-1 self-start sm:self-auto disabled:opacity-50"
            >
              <span>{isSimulatingPayment ? 'Processing DuitNow Transfer...' : `⚡ Simulate Payment (${formatMYR(firstOverdue.amountSen)})`}</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Available Cash */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Available Cash
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatMYR(availableCashSen)}
            </div>
            <div className="flex items-center space-x-1 mt-1 text-xs text-slate-500">
              <span className="text-emerald-700 font-medium">
                {businessProfile.bankName ? `${businessProfile.bankName} ${businessProfile.accountNumberMasked || ''}` : 'Operating Account'}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Current cleared bank balance
          </div>
        </div>

        {/* Metric 2: Upcoming Bills */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Upcoming Bills
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatMYR(upcomingBillsSen)}
            </div>
            <div className="flex items-center space-x-1 mt-1 text-xs text-rose-600 font-medium">
              <span>{bills.length} vendor commitment(s)</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Payables scheduled in forecast horizon
          </div>
        </div>

        {/* Metric 3: Outstanding Receivables */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Outstanding Receivables
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatMYR(outstandingReceivablesSen)}
            </div>
            <div className="flex items-center space-x-1 mt-1 text-xs">
              {overdueReceivablesSen > 0 ? (
                <span className="text-rose-600 font-medium">
                  {formatMYR(overdueReceivablesSen)} overdue
                </span>
              ) : (
                <span className="text-emerald-600 font-medium">All current invoices up to date</span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            {firstOverdue ? `${firstOverdue.customerName} (${firstOverdue.id})` : `${invoices.length} invoice(s) tracked`}
          </div>
        </div>

        {/* Metric 4: Lowest Projected Cash */}
        <div className={`p-5 rounded-xl border shadow-xs flex flex-col justify-between ${
          lowestBalanceSen < 0
            ? 'bg-rose-50/50 border-rose-200'
            : lowestBalanceSen < minReserveSen
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-emerald-50/40 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Lowest Projected Cash
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              lowestBalanceSen < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {lowestBalanceSen < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold font-mono tracking-tight ${
              lowestBalanceSen < 0 ? 'text-rose-700' : 'text-teal-800'
            }`}>
              {formatMYR(lowestBalanceSen)}
            </div>
            <div className="flex items-center space-x-1 mt-1 text-xs">
              {lowestBalanceSen < minReserveSen ? (
                <span className="text-rose-700 font-semibold">
                  Deficit: -{formatMYR(minReserveSen - lowestBalanceSen)} under reserve
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold">
                  Reserve Protected (100% Intact)
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
            Safety reserve target: {formatMYR(minReserveSen)}
          </div>
        </div>
      </div>

      {/* 30-Day Cash Forecast Interactive Chart Component */}
      <ForecastChart points={forecast} minReserveSen={minReserveSen} />

      {/* Two Column Section: Upcoming Obligations & AI Copilot Action Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upcoming Invoices & Bills Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Financial Obligations & Receivables
              </h3>
              <p className="text-xs text-slate-500">Next 14 days critical schedule</p>
            </div>
            <button
              onClick={() => setActiveTab('data-setup')}
              className="text-xs text-teal-800 hover:text-teal-900 font-medium"
            >
              View All Records →
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* Overdue Invoice Item */}
            {invoices.map((inv) => (
              <div key={inv.id} className="p-4 hover:bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-slate-900">{inv.customerName}</span>
                      <span className="text-slate-400 font-mono">({inv.id})</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        inv.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {inv.status === 'paid' ? 'PAID' : `${inv.daysOverdue}D OVERDUE`}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{inv.description}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-mono font-bold ${
                    inv.status === 'paid' ? 'text-slate-500 line-through' : 'text-emerald-700'
                  }`}>
                    +{formatMYR(inv.amountSen)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {inv.status === 'paid' ? 'Settled via DuitNow' : `Due: ${inv.dueDate}`}
                  </div>
                </div>
              </div>
            ))}

            {/* Bills Items */}
            {bills.map((bill) => (
              <div key={bill.id} className="p-4 hover:bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-slate-900">{bill.vendorName}</span>
                      <span className="text-slate-400 font-mono">({bill.id})</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-1.5 py-0.2 rounded">
                        Due in {bill.dueDayOffset} days
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{bill.description}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-rose-700">
                    -{formatMYR(bill.amountSen)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Due: {bill.dueDate}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: AI Copilot Action & Activity Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  CashPilot Proactive Assistant
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {proposedActions.length} Actions in Queue
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {proposedActions.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-slate-900">
                      {act.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        act.status === 'Executed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : act.status === 'Approved'
                          ? 'bg-teal-100 text-teal-800'
                          : act.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {act.purpose}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60">
                    <span className="text-slate-500">Target: {act.targetEntity}</span>
                    <span className="font-mono font-semibold text-teal-800">
                      Impact: {formatMYR(act.amountSen)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              CashPilot enforces human-in-the-loop authorization.
            </span>
            <button
              onClick={() => setActiveTab('actions')}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1"
            >
              <span>Manage Approvals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
