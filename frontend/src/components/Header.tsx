import React from 'react';
import { useFinance, NavigationTab } from '../context/FinanceContext';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Database,
  ArrowRight,
  TrendingDown,
  Building2,
  Cpu
} from 'lucide-react';
import { formatMYR } from '../utils/financeCalculations';

export const Header: React.FC = () => {
  const {
    businessProfile,
    activeTab,
    setActiveTab,
    currentAlert,
    hasSimulatedPayment,
    resetDemo,
    geminiActive,
    setShowOnboarding,
    proposedActions
  } = useFinance();

  const isHealthy = currentAlert.severity === 'healthy';
  const isApproved = proposedActions.some((a) => a.status === 'Approved' || a.status === 'Executed');
  const isExecuted = proposedActions.some((a) => a.status === 'Executed');
  const isReforecasted = hasSimulatedPayment && isHealthy;

  const navItems: { id: NavigationTab; label: string; badge?: string }[] = [
    { id: 'dashboard', label: 'Command Center' },
    { id: 'diagnosis', label: 'Risk Diagnosis', badge: !isHealthy && currentAlert.severity !== 'insufficient_data' ? '1 Risk' : undefined },
    { id: 'scenarios', label: 'Scenario Planner', badge: '3 Plans' },
    { id: 'actions', label: 'Action & Approvals' },
    { id: 'copilot', label: 'AI Copilot' },
    { id: 'timeline', label: 'Simulation & Timeline' },
    { id: 'audit', label: 'Audit & Report', badge: isReforecasted ? 'Verified' : undefined },
    { id: 'data-setup', label: 'Upload & Setup' }
  ];

  // Lifecycle workflow step progression with direct click navigation
  const workflowSteps: { num: number; label: string; tab: NavigationTab; done: boolean; active: boolean }[] = [
    { num: 1, label: 'Detect', tab: 'dashboard', done: true, active: activeTab === 'dashboard' },
    { num: 2, label: 'Diagnose', tab: 'diagnosis', done: true, active: activeTab === 'diagnosis' },
    { num: 3, label: 'Plan', tab: 'scenarios', done: true, active: activeTab === 'scenarios' },
    { num: 4, label: 'Approve', tab: 'actions', done: isApproved, active: activeTab === 'actions' },
    { num: 5, label: 'Execute', tab: 'timeline', done: isExecuted, active: activeTab === 'timeline' },
    { num: 6, label: 'Reforecast', tab: 'audit', done: isReforecasted, active: activeTab === 'audit' }
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Bar: Brand, Business, AI Status, Reset */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Company */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center space-x-2.5 focus:outline-hidden group text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-white shadow-xs group-hover:bg-teal-800 transition">
                <span className="font-bold text-lg tracking-tight">CP</span>
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-900 text-base tracking-tight">CashPilot</span>
                  <span className="bg-teal-50 text-teal-800 text-[10px] font-medium px-1.5 py-0.5 rounded border border-teal-200">
                    SME Copilot
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-normal">Anticipate. Act. Protect Cash.</p>
              </div>
            </button>

            <div className="hidden md:block h-6 w-px bg-slate-200" />

            {/* Active Business Selector Indicator */}
            <div className="hidden lg:flex items-center space-x-2 text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium text-slate-800">{businessProfile.name || 'Your Company'}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{businessProfile.currency}</span>
              {businessProfile.bankName && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">{businessProfile.bankName.split(' ')[0]} {businessProfile.accountNumberMasked || ''}</span>
                </>
              )}
            </div>
          </div>

          {/* Right Status Badges & Quick Action Controls */}
          <div className="flex items-center space-x-2.5">
            {/* AI Agent Status Pill */}
            <div className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              geminiActive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              <span>{geminiActive ? 'Gemini 3.8 Flash AI' : 'Rules Engine'} Active</span>
            </div>

            {/* Cash Status Pill */}
            <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isHealthy
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
            }`}>
              {isHealthy ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reserve Protected</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Deficit of {formatMYR(currentAlert.reserveDeficitSen)}</span>
                </>
              )}
            </div>

            {/* Clear / Reset Data Button */}
            <button
              onClick={() => {
                if (window.confirm('Clear all uploaded records and start fresh?')) {
                  resetDemo();
                }
              }}
              title="Clear all records and start fresh"
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Data</span>
            </button>

            {/* Guided Tour / Welcome */}
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-2.5 py-1.5 text-xs text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 font-medium rounded-lg transition"
            >
              Tour
            </button>
          </div>
        </div>

        {/* Workflow Lifecycle Bar (Detect -> Diagnose -> Plan -> Approve -> Execute -> Verify -> Reforecast) */}
        <div className="py-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] overflow-x-auto scrollbar-none">
          <div className="flex items-center space-x-1 text-slate-500 font-medium whitespace-nowrap">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] mr-1">Lifecycle:</span>
            {workflowSteps.map((step, idx) => (
              <React.Fragment key={step.num}>
                <button
                  type="button"
                  onClick={() => setActiveTab(step.tab)}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded transition ${
                    step.active
                      ? 'bg-teal-700 text-white font-bold shadow-2xs'
                      : step.done
                      ? 'text-teal-900 font-semibold bg-teal-50 hover:bg-teal-100'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                  title={`Navigate to Step ${step.num}: ${step.label}`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                    step.active
                      ? 'bg-white text-teal-800 font-bold'
                      : step.done
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
                {idx < workflowSteps.length - 1 && (
                  <span className="text-slate-300">→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="hidden md:flex items-center text-slate-500 text-xs">
            <span>Forecast: <strong>30 Days</strong> (15 Oct – 14 Nov 2026)</span>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <nav className="flex space-x-1 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                      item.badge.includes('Risk')
                        ? 'bg-rose-100 text-rose-800'
                        : item.badge === 'Verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
