import React, { useState } from 'react';
import { ProposedAction } from '../types/finance';
import { formatMYR } from '../utils/financeCalculations';
import {
  X,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Copy,
  Send,
  Lock,
  Mail,
  Building,
  User,
  ShieldCheck
} from 'lucide-react';

interface ActionDetailModalProps {
  action: ProposedAction;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string, reason?: string) => void;
  onSaveDraft: (actionId: string, subject: string, body: string) => void;
  onExecute: (actionId: string) => void;
  isSimulatingAction: boolean;
  geminiActive: boolean;
}

export const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
  action,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onSaveDraft,
  onExecute,
  isSimulatingAction,
  geminiActive
}) => {
  const [subject, setSubject] = useState(action.draftMessageSubject || '');
  const [body, setBody] = useState(action.draftMessageBody || '');
  const [isDraftingAi, setIsDraftingAi] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  const handleAiRedraft = async () => {
    setIsDraftingAi(true);
    try {
      const res = await fetch('/api/ai/draft-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: action.targetEntity,
          contactPerson: action.recipientContact,
          invoiceNumber: action.referenceId,
          amount: (action.amountSen / 100).toFixed(2),
          daysOverdue: 8,
          businessName: 'Bloom & Co Sdn Bhd'
        })
      });
      const data = await res.json();
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
    } catch {
      // Keep existing
    } finally {
      setIsDraftingAi(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = () => {
    onSaveDraft(action.id, subject, body);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-semibold text-slate-500">{action.id}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  action.status === 'Executed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : action.status === 'Approved'
                    ? 'bg-teal-100 text-teal-800'
                    : action.status === 'Rejected'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {action.status}
              </span>
              <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium flex items-center space-x-1">
                <Lock className="w-2.5 h-2.5" />
                <span>Human-in-the-Loop</span>
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              {action.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Entity</span>
              <span className="font-semibold text-slate-800">{action.targetEntity}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reference Record</span>
              <span className="font-mono font-semibold text-slate-800">{action.referenceId}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Recoverable Amount</span>
              <span className="font-mono font-bold text-teal-800">{formatMYR(action.amountSen)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Risk Level</span>
              <span className="font-semibold text-emerald-700">{action.riskLevel} Operational Risk</span>
            </div>
          </div>

          {/* Expected Outcome */}
          <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200">
            <span className="font-bold text-teal-900 block text-[11px]">
              Expected Financial Outcome:
            </span>
            <p className="text-teal-800 mt-0.5 leading-relaxed">
              {action.expectedEffect}
            </p>
          </div>

          {/* Message / Notice Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Mail className="w-4 h-4 text-teal-700" />
                <span>Prepared Communication (Simulated WhatsApp / Email)</span>
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleAiRedraft}
                  disabled={isDraftingAi}
                  className="px-2.5 py-1 text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md font-medium text-[11px] transition flex items-center space-x-1 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isDraftingAi ? 'Drafting...' : 'Redraft with AI'}</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md font-medium text-[11px] transition flex items-center space-x-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Recipient details */}
            <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>Recipient:</strong> {action.recipientContact || 'Accounts Dept'}</span>
              <span><strong>Email:</strong> {action.recipientEmail || 'billing@megaretail.com.my'}</span>
              <span><strong>Channel:</strong> DuitNow Official Notice</span>
            </div>

            {/* Subject Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Subject Line:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setIsEditing(true);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
              />
            </div>

            {/* Body Textarea */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Notice Body:
              </label>
              <textarea
                rows={7}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setIsEditing(true);
                }}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {isEditing && (
              <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-[11px] text-amber-800">
                  You modified the draft. Changes require saving and explicit approval.
                </span>
                <button
                  onClick={handleSaveDraft}
                  className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-medium"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* Execution Receipt if already executed */}
          {action.executionReceipt && (
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
              <div className="flex items-center space-x-1.5 text-emerald-800 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Simulated Dispatch Verification Receipt</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-emerald-900 font-mono">
                <div>Channel: {action.executionReceipt.channel}</div>
                <div>Dispatch ID: #{action.executionReceipt.dispatchId}</div>
                <div>Timestamp: {action.executionReceipt.sentAt}</div>
                <div>Status: Verified Delivery</div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {action.status !== 'Rejected' && (
              <button
                onClick={() => {
                  onReject(action.id, 'Discretionary hold by business owner');
                  onClose();
                }}
                className="px-3 py-2 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl font-medium transition"
              >
                Reject Action
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl font-medium transition"
            >
              Close
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {action.status === 'Pending Approval' || action.status === 'Draft' ? (
              <button
                onClick={() => {
                  onApprove(action.id);
                  onClose();
                }}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approve Action</span>
              </button>
            ) : action.status === 'Approved' ? (
              <button
                onClick={() => {
                  onExecute(action.id);
                  onClose();
                }}
                disabled={isSimulatingAction}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSimulatingAction ? 'Executing Simulation...' : 'Execute Simulated Dispatch'}</span>
              </button>
            ) : (
              <span className="text-xs font-medium text-emerald-700 flex items-center space-x-1">
                <CheckCircle className="w-4 h-4" />
                <span>Action Finalized</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
