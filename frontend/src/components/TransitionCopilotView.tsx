// TransitionAI — AI Green Finance Copilot
import React, { useState, useRef, useEffect } from 'react';
import { useTransition } from '../context/TransitionContext';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Coins,
  Leaf,
  FileCheck2,
  Lock
} from 'lucide-react';

export const TransitionCopilotView: React.FC = () => {
  const {
    copilotMessages,
    isCopilotLoading,
    sendCopilotMessage,
    currentRole,
    profile,
    baseline,
    financial,
    greenLoanEligibility
  } = useTransition();

  const [inputMessage, setInputMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages, isCopilotLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isCopilotLoading) return;
    const msg = inputMessage;
    setInputMessage('');
    await sendCopilotMessage(msg);
  };

  // Role-Specific Prompt Suggestions
  const rolePrompts: Record<string, string[]> = {
    sme_owner: [
      'Can our business cash flow afford RM 250k for rooftop solar at 3.75%?',
      'How much annual electricity cost can we cut with our planned roadmap?',
      'Which decarbonisation actions deliver the fastest cash payback?',
      'What documents do we need to upload to achieve 90% audit confidence?'
    ],
    finance_manager: [
      'What is our maximum debt capacity under a 1.25x DSCR covenant?',
      'Compare our monthly loan repayment against our monthly energy bill savings.',
      'How does existing debt service impact our green loan eligibility?',
      'Explain the 10-year NPV calculation and discount rate assumptions.'
    ],
    lender: [
      'Does this SME meet the BNM Low Carbon Transition Facility (LCTF) criteria?',
      'What is the verification grade and source evidence backing Scope 2 electricity?',
      'Perform a DSCR stress test if electricity savings underperform by 15%.',
      'What are the primary credit risks and proposed mitigants for this borrower?'
    ]
  };

  const activePrompts = rolePrompts[currentRole] || rolePrompts.sme_owner;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Green Finance Copilot</h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              Gemini 3.8 Flash
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Grounded strictly in your uploaded records, deterministic carbon baselines, and financial formulas. Never invents figures or fake criteria.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
          <span className="text-slate-500">Active Persona:</span>
          <span className="font-bold text-slate-800 uppercase">{currentRole.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[600px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {copilotMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-slate-900 text-white'
                      : 'bg-emerald-600 text-white shadow-xs'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                  <div
                    className={`mt-2 flex items-center justify-between text-[10px] ${
                      isUser ? 'text-slate-400' : 'text-slate-400 border-t border-slate-100 pt-1.5'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.isAiPowered && (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <ShieldCheck className="w-3 h-3" /> Grounded in Uploaded Facts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isCopilotLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-xs text-xs text-slate-500 flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>TransitionAI is analyzing your baseline and debt covenants...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Pill Carousel */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0">Suggested:</span>
          {activePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => {
                setInputMessage(prompt);
              }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full whitespace-nowrap transition shrink-0 font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-200 flex items-center space-x-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Ask TransitionAI as ${currentRole.replace('_', ' ')} (e.g. debt service, carbon baseline, green grants)...`}
            className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isCopilotLoading}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center space-x-1.5 shrink-0"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
