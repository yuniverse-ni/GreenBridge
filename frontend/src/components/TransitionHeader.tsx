// TransitionAI Application Header
import React from 'react';
import { useTransition } from '../context/TransitionContext';
import { UserRole, TransitionTab } from '../types/transition';
import {
  Leaf,
  ShieldCheck,
  Building,
  Coins,
  FileCheck2,
  Sparkles,
  RotateCcw,
  UploadCloud,
  Layers,
  BarChart3,
  Lightbulb,
  FileText,
  Lock,
  ExternalLink,
  Calculator,
  Scale
} from 'lucide-react';
import { formatCurrency } from '../utils/transitionCalculations';

export const TransitionHeader: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    activeTab,
    setActiveTab,
    profile,
    baseline,
    financial,
    activityRecords,
    loadSampleData,
    clearWorkspace,
    isLoading
  } = useTransition();

  const navItems: { id: TransitionTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Command Center', icon: <Layers className="w-4 h-4" /> },
    {
      id: 'ingestion',
      label: 'Upload & Ingestion',
      icon: <UploadCloud className="w-4 h-4" />,
      badge: activityRecords.length > 0 ? `${activityRecords.length}` : 'Empty'
    },
    {
      id: 'baseline',
      label: 'Carbon Baseline',
      icon: <Leaf className="w-4 h-4" />,
      badge: baseline.totalTCO2e > 0 ? `${baseline.totalTCO2e} t` : undefined
    },
    { id: 'financials', label: 'Financials & Budget', icon: <Coins className="w-4 h-4" /> },
    { id: 'actions', label: 'Decarbonisation Actions', icon: <Lightbulb className="w-4 h-4" /> },
    {
      id: 'transition-plan',
      label: 'Lender Transition Pack',
      icon: <FileCheck2 className="w-4 h-4" />,
      badge: 'Financing-Ready'
    },
    { id: 'copilot', label: 'AI Copilot', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Trail', icon: <FileText className="w-4 h-4" /> },
    { id: 'test-suite', label: 'Test Suite (A–L)', icon: <Calculator className="w-4 h-4" />, badge: '12/12' },
    { id: 'legal-governance', label: 'Legal & Privacy', icon: <Scale className="w-4 h-4" /> }
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner: App Brand, Role Switcher, Quick Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-500/20">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">TransitionAI</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Green Finance Copilot
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {profile.name || 'SME Workspace'} • {profile.industry || 'Real Financial & Operational Data'}
              </p>
            </div>
          </div>

          {/* Role Switcher & Workspace Actions */}
          <div className="flex items-center space-x-3">
            {/* Role Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
              <span className="text-slate-500 px-2 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Role:
              </span>
              <button
                onClick={() => setCurrentRole('sme_owner')}
                className={`px-2.5 py-1 rounded-md transition ${
                  currentRole === 'sme_owner'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="SME Owner: Full control, uploads, strategy & disclosure authorization"
              >
                SME Owner
              </button>
              <button
                onClick={() => setCurrentRole('finance_manager')}
                className={`px-2.5 py-1 rounded-md transition ${
                  currentRole === 'finance_manager'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Finance Manager: Debt capacity, cash flows, loan modeling"
              >
                Finance Mgr
              </button>
              <button
                onClick={() => setCurrentRole('lender')}
                className={`px-2.5 py-1 rounded-md transition ${
                  currentRole === 'lender'
                    ? 'bg-amber-100 text-amber-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Lender / Credit Analyst: Accesses only authorized transition package & evidence"
              >
                Lender / Credit
              </button>
            </div>

            {/* Quick Testing Actions */}
            <div className="hidden md:flex items-center space-x-2">
              <button
                onClick={loadSampleData}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition flex items-center gap-1.5"
                title="Load realistic sample dataset (Apex Precision Engineering: 12 TNB electricity bills, diesel fuel, pipeline gas)"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Load Sample Data</span>
              </button>

              <button
                onClick={clearWorkspace}
                disabled={isLoading}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1"
                title="Clear all records to start with a fresh empty workspace"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex space-x-1 overflow-x-auto py-2 no-scrollbar border-t border-slate-100">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                      isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
