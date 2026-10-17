import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatMYR } from '../utils/financeCalculations';
import {
  Sparkles,
  Send,
  MessageSquare,
  Bot,
  User,
  AlertCircle,
  FileText,
  Building,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { CopilotChatMessage } from '../types/finance';

export const CopilotChatView: React.FC = () => {
  const {
    isDataLoaded,
    businessProfile,
    invoices,
    bills,
    geminiActive,
    setActiveTab
  } = useFinance();

  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    {
      id: 'MSG-INIT',
      sender: 'assistant',
      text: isDataLoaded
        ? `Hello! I am your CashPilot AI financial copilot. I am actively monitoring ${invoices.length} uploaded invoice(s), ${bills.length} supplier bill(s), and your current cash balance of ${formatMYR(businessProfile.initialCashSen || 0)}. What would you like to know about your cash flow?`
        : 'Welcome to CashPilot. To ask questions about your cash position, unpaid invoices, or bills, please upload your financial files first.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const sampleQuestions = [
    'Will I have enough cash to pay next month\'s bills?',
    'Which unpaid invoices are putting my cash flow at risk?',
    'Which customers should I follow up with first?',
    'What happens if a customer pays 7 days late?',
    'Which expenses could I postpone to avoid a cash shortage?'
  ];

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: CopilotChatMessage = {
      id: `USER-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/ai/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-4)
        })
      });
      const data = await res.json();

      const aiMsg: CopilotChatMessage = {
        id: `AI-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'I analyzed your financial records but could not generate a response.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: CopilotChatMessage = {
        id: `AI-${Date.now()}`,
        sender: 'assistant',
        text: 'Unable to connect to financial intelligence service. Please check your connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              AI Financial Copilot
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              geminiActive
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {geminiActive ? 'Gemini 3.8 Flash' : 'Grounded Rules Engine'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Ask questions grounded strictly in your real uploaded invoices, bills, and cash records.
          </p>
        </div>

        {isDataLoaded ? (
          <div className="text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center space-x-2 text-slate-600">
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            <span>Grounded in {invoices.length} Invoices & {bills.length} Bills</span>
          </div>
        ) : (
          <button
            onClick={() => setActiveTab('data-setup')}
            className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
          >
            <span>Upload Records First</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!isDataLoaded && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Real Data Grounding Active:</strong>
            CashPilot does not invent fictional numbers or fabricate data. To ask questions about cash shortfalls, overdue clients, or expense timing, please upload your files first.
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[520px] overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-slate-800 text-white'
                    : 'bg-teal-700 text-white shadow-xs'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`mt-1.5 text-[10px] ${
                    msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-2 text-xs text-slate-500 italic">
              <Bot className="w-4 h-4 text-teal-700 animate-spin" />
              <span>CashPilot is analyzing uploaded records...</span>
            </div>
          )}
        </div>

        {/* Suggested Questions */}
        {isDataLoaded && (
          <div className="px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto scrollbar-none text-[11px]">
            <span className="text-slate-400 shrink-0 font-medium">Suggestions:</span>
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isTyping}
                className="shrink-0 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full transition disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={
                isDataLoaded
                  ? "Ask about your cash, invoices, or upcoming bills..."
                  : "Upload financial data first to ask questions..."
              }
              disabled={!isDataLoaded || isTyping}
              className="flex-1 px-4 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-hidden disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!isDataLoaded || !inputQuery.trim() || isTyping}
              className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 flex items-center space-x-1"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
