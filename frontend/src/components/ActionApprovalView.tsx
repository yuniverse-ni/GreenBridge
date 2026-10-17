import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ProposedAction } from '../types/finance';
import { formatMYR } from '../utils/financeCalculations';
import { ActionDetailModal } from './ActionDetailModal';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Eye,
  Check,
  X,
  Lock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Zap
} from 'lucide-react';

export const ActionApprovalView: React.FC = () => {
  const {
    proposedActions,
    approveAction,
    rejectAction,
    updateActionDraft,
    executeSimulatedAction,
    isSimulatingAction,
    setActiveTab,
    selectedPlanId,
    candidatePlans,
    geminiActive
  } = useFinance();

  const [activeModalAction, setActiveModalAction] = useState<ProposedAction | null>(null);

  const selectedPlan = candidatePlans.find((p) => p.id === selectedPlanId) || candidatePlans[0];

  if (!selectedPlan || proposedActions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-2xl mx-auto my-8 shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto mb-3 border border-teal-200">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Pending Actions in Queue</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          When liquidity risks or overdue receivables are detected from your uploaded records, CashPilot prepares structured actions here for your explicit human authorization.
        </p>
        <button
          onClick={() => setActiveTab('data-setup')}
          className="mt-5 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-semibold transition"
        >
          Upload Financial Records
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Action & Approval Center
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
              Human-in-the-Loop Governance
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            CashPilot prepares, drafts, and simulates financial actions. Execution requires your explicit authorization.
          </p>
        </div>

        {/* Next step CTA */}
        <button
          onClick={() => setActiveTab('timeline')}
          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-medium transition flex items-center justify-center space-x-2 self-start md:self-auto shadow-xs"
        >
          <span>Go to Execution Timeline</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Safety & Governance Policy Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-600">
        <div className="w-6 h-6 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="font-bold text-slate-900">Governance Principle:</span> CashPilot acts as an autonomous financial participant with explicit boundary checks. The AI cannot transfer real funds, borrow money, or alter supplier legal contracts. Approvals apply solely to exact documented parameters.
        </div>
      </div>

      {/* Selected Strategy Context Pill */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Active Strategic Framework:</span>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {selectedPlan.code}: {selectedPlan.name}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {selectedPlan.strategySummary}
          </p>
        </div>

        <button
          onClick={() => setActiveTab('scenarios')}
          className="text-xs text-teal-800 hover:text-teal-900 font-semibold underline self-start sm:self-auto"
        >
          Change Selected Plan
        </button>
      </div>

      {/* Action Checklist Cards */}
      <div className="space-y-4">
        {proposedActions.map((action, index) => {
          const isPending = action.status === 'Pending Approval';
          const isApproved = action.status === 'Approved';
          const isExecuted = action.status === 'Executed';
          const isRejected = action.status === 'Rejected';

          return (
            <div
              key={action.id}
              className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                isApproved
                  ? 'border-teal-300 ring-1 ring-teal-200'
                  : isExecuted
                  ? 'border-emerald-300 bg-emerald-50/10'
                  : isRejected
                  ? 'border-slate-200 opacity-60'
                  : 'border-slate-200'
              }`}
            >
              <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Info */}
                <div className="flex items-start space-x-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isExecuted
                        ? 'bg-emerald-100 text-emerald-700'
                        : isApproved
                        ? 'bg-teal-100 text-teal-800'
                        : isRejected
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isExecuted ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : isApproved ? (
                      <Check className="w-5 h-5" />
                    ) : isRejected ? (
                      <X className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500">
                        {action.id}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {action.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isExecuted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isApproved
                            ? 'bg-teal-100 text-teal-800'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {action.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {action.purpose}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span><strong>Target:</strong> {action.targetEntity}</span>
                      <span><strong>Reference:</strong> {action.referenceId}</span>
                      <span><strong>Impact:</strong> {formatMYR(action.amountSen)}</span>
                      <span><strong>Risk:</strong> {action.riskLevel}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action Controls */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 self-end lg:self-center shrink-0">
                  {/* View Details / Draft Modal Trigger */}
                  <button
                    onClick={() => setActiveModalAction(action)}
                    className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center space-x-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Draft & Details</span>
                  </button>

                  {/* Quick Action: Approve */}
                  {isPending && (
                    <button
                      onClick={() => approveAction(action.id)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition flex items-center space-x-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {/* Quick Action: Execute Simulation */}
                  {isApproved && (
                    <button
                      onClick={() => executeSimulatedAction(action.id)}
                      disabled={isSimulatingAction}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-xl shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSimulatingAction ? 'Executing...' : 'Execute Simulation'}</span>
                    </button>
                  )}

                  {/* Reject option if not yet rejected */}
                  {!isRejected && !isExecuted && (
                    <button
                      onClick={() => rejectAction(action.id, 'Declined by owner')}
                      title="Decline this proposal"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Executed indicator */}
                  {isExecuted && (
                    <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Executed (Simulated)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution details strip if executed */}
              {action.executionReceipt && (
                <div className="bg-emerald-50/70 border-t border-emerald-100 px-5 py-2.5 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px]">
                    Transmission ID: {action.executionReceipt.dispatchId} via {action.executionReceipt.channel}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Delivered at {action.executionReceipt.sentAt}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal for Details / Editing */}
      {activeModalAction && (
        <ActionDetailModal
          action={activeModalAction}
          isOpen={!!activeModalAction}
          onClose={() => setActiveModalAction(null)}
          onApprove={approveAction}
          onReject={rejectAction}
          onSaveDraft={updateActionDraft}
          onExecute={executeSimulatedAction}
          isSimulatingAction={isSimulatingAction}
          geminiActive={geminiActive}
        />
      )}
    </div>
  );
};
