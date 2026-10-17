import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatMYR } from '../utils/financeCalculations';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Zap,
  Info
} from 'lucide-react';

export const TimelineExecutionView: React.FC = () => {
  const {
    invoices,
    auditLogs,
    hasSimulatedPayment,
    isSimulatingPayment,
    simulateCustomerPayment,
    setActiveTab,
    proposedActions,
    simulatedPaymentMeta,
    businessProfile
  } = useFinance();

  const executedActionsCount = proposedActions.filter((a) => a.status === 'Executed').length;
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue' || i.daysOverdue > 0);
  const targetInvoice = overdueInvoices[0] || invoices.find((i) => i.status !== 'paid') || invoices[0];
  const targetId = targetInvoice ? targetInvoice.id : 'INV-SETTLE';
  const targetName = targetInvoice ? targetInvoice.customerName : 'Client';
  const targetAmountSen = targetInvoice ? targetInvoice.amountSen : 1200000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Execution & Activity Timeline
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
              Simulation Sandbox
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Chronological audit trail of agent detections, human authorizations, and simulated operations.
          </p>
        </div>

        {hasSimulatedPayment && (
          <button
            onClick={() => setActiveTab('audit')}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center space-x-2 self-start md:self-auto shadow-xs"
          >
            <span>View Before & After Audit Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Prominent Demo Payment Trigger Card */}
      <div className={`rounded-2xl border p-6 transition-all ${
        hasSimulatedPayment
          ? 'bg-emerald-50/50 border-emerald-300'
          : 'bg-linear-to-r from-teal-50 via-slate-50 to-white border-teal-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              hasSimulatedPayment
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-teal-700 text-white shadow-xs'
            }`}>
              {hasSimulatedPayment ? <CheckCircle2 className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  hasSimulatedPayment
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-teal-100 text-teal-800'
                }`}>
                  {hasSimulatedPayment ? 'Payment Confirmed' : 'Verification Step'}
                </span>
                <span className="text-xs text-slate-500">
                  Target: {targetName} ({targetId})
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                {hasSimulatedPayment
                  ? `Customer Payment Reconciled: +${formatMYR(simulatedPaymentMeta?.amountSen || targetAmountSen)} Received`
                  : 'Simulate Customer Payment Settlement'}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {hasSimulatedPayment
                  ? `${businessProfile.bankName || 'Bank'} account credited with ${formatMYR(simulatedPaymentMeta?.amountSen || targetAmountSen)} via DuitNow instant transfer. CashPilot has closed invoice ${simulatedPaymentMeta?.invoiceId || targetId} and reforecasted all days.`
                  : `After dispatching the payment notice, simulate ${targetName} receiving the reminder and completing an instant bank transfer of ${formatMYR(targetAmountSen)} via DuitNow.`}
              </p>
            </div>
          </div>

          <div className="shrink-0 self-start lg:self-center">
            {!hasSimulatedPayment ? (
              <button
                onClick={() => simulateCustomerPayment(targetId)}
                disabled={isSimulatingPayment}
                className="w-full sm:w-auto px-5 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {isSimulatingPayment
                    ? 'Simulating DuitNow Inbound Transfer...'
                    : `⚡ Simulate Customer Payment (${formatMYR(targetAmountSen)})`}
                </span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-emerald-100/80 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>DuitNow Cleared & Reconciled</span>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer Notice */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center space-x-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            <strong>Simulation Guardrail:</strong> CashPilot simulated executions do not dispatch external emails or transact real bank funds.
          </span>
        </div>
      </div>

      {/* Chronological Step-by-Step Activity Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-semibold text-slate-900 text-sm mb-4">
          Chronological Event Progression (7-Stage Lifecycle)
        </h3>

        <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {auditLogs.map((log, index) => {
            const isCompleted = log.statusBadge === 'completed';
            const isFlagged = log.statusBadge === 'flagged';

            return (
              <div key={log.id} className="relative group">
                {/* Node icon on timeline */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-0 w-6 sm:w-8 h-6 sm:h-8 rounded-full border-2 border-white flex items-center justify-center text-xs shadow-xs ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isFlagged
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  <span className="text-[10px] font-bold">{log.stepNumber}</span>
                </div>

                {/* Content Box */}
                <div className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-4 transition text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Stage {log.stepNumber}: {log.stage}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isFlagged
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.statusBadge.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{log.timestamp}</span>
                    </div>
                  </div>

                  <h4 className="font-semibold text-slate-800 mt-2 text-xs sm:text-sm">
                    {log.summary}
                  </h4>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    {log.detail}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center space-x-1">
                      {log.actor.includes('AI') ? (
                        <Cpu className="w-3.5 h-3.5 text-teal-700" />
                      ) : log.actor.includes('Owner') ? (
                        <UserCheck className="w-3.5 h-3.5 text-slate-700" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-emerald-700" />
                      )}
                      <span>Actor: {log.actor}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">ID: {log.id}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
