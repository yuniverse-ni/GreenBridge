import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { parseMYRToSen } from '../utils/financeCalculations';
import {
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingDown,
  Building2,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    resetDemo,
    setActiveTab,
    updateBusinessProfile,
    businessProfile
  } = useFinance();

  const [mode, setMode] = useState<'welcome' | 'custom-setup'>('welcome');
  const [bizName, setBizName] = useState(businessProfile.name || '');
  const [cashRM, setCashRM] = useState(businessProfile.initialCashSen ? (businessProfile.initialCashSen / 100).toString() : '0');
  const [reserveRM, setReserveRM] = useState(businessProfile.minReserveSen ? (businessProfile.minReserveSen / 100).toString() : '0');
  const [horizon, setHorizon] = useState(businessProfile.forecastHorizonDays ? businessProfile.forecastHorizonDays.toString() : '30');
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!showOnboarding) return null;

  const handleStartDemo = () => {
    resetDemo();
    setShowOnboarding(false);
    setActiveTab('dashboard');
  };

  const handleSaveCustomBiz = () => {
    updateBusinessProfile({
      name: bizName,
      initialCashSen: parseMYRToSen(cashRM),
      minReserveSen: parseMYRToSen(reserveRM),
      forecastHorizonDays: Number(horizon) || 30
    });
    setShowOnboarding(false);
    setActiveTab('dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-white font-bold text-sm">
              CP
            </div>
            <span className="font-bold text-slate-900 text-sm">CashPilot Onboarding</span>
          </div>
          <button
            onClick={() => setShowOnboarding(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {mode === 'welcome' ? (
            <>
              {/* Headline & Subtitle */}
              <div className="text-center max-w-lg mx-auto">
                <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200 font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                  AI Finance Copilot for Malaysian SMEs
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
                  Know Your Cash. Control Your Next Move.
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  Your AI finance copilot helps you anticipate cash shortages and take action before they become problems.
                </p>
              </div>

              {/* 3 Simple Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="w-8 h-8 bg-teal-100 text-teal-800 rounded-xl flex items-center justify-center mx-auto text-xs font-bold">
                    1
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-2">
                    Understand Your Cash
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    View 30-day cash projections with your verified bank balances, bills, and receivables.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="w-8 h-8 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center mx-auto text-xs font-bold">
                    2
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-2">
                    Discover Risks Early
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    CashPilot spots reserve deficits days in advance and traces the exact root cause.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center mx-auto text-xs font-bold">
                    3
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-2">
                    Take Action Confidently
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Evaluate recovery plans, authorize prepared actions, and verify reforecasted health.
                  </p>
                </div>
              </div>

              {/* Real Data Ingestion Guide */}
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 flex items-start space-x-3 text-xs">
                <Sparkles className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div className="text-teal-900">
                  <strong className="block font-semibold">100% Real User-Uploaded Data</strong>
                  <span>
                    Upload your actual bank statements, customer invoices, or supplier payables in CSV, Excel (.xlsx, .xls), or PDF. CashPilot maps your records, detects upcoming liquidity shortages, and generates deterministic recovery plans.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    setActiveTab('data-setup');
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center space-x-2"
                >
                  <span>Upload Financial Records</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setMode('custom-setup')}
                  className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center space-x-1"
                >
                  <span>Configure Business Profile</span>
                </button>
              </div>
            </>
          ) : (
            /* Mode: Custom Business Setup Form */
            <div className="space-y-5">
              <div>
                <button
                  onClick={() => setMode('welcome')}
                  className="text-xs text-teal-800 font-semibold hover:underline mb-2 block"
                >
                  ← Back to Welcome Overview
                </button>
                <h2 className="text-xl font-bold text-slate-900">
                  Quick Business Profile Setup
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set baseline parameters for your Malaysian business. Defaults are pre-filled in MYR.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Business Name:
                  </label>
                  <input
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Currency:
                  </label>
                  <input
                    type="text"
                    value="MYR (Malaysian Ringgit)"
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-xl text-xs text-slate-500 font-medium cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Current Cleared Cash (RM):
                  </label>
                  <input
                    type="number"
                    value={cashRM}
                    onChange={(e) => setCashRM(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Minimum Safety Reserve (RM):
                  </label>
                  <input
                    type="number"
                    value={reserveRM}
                    onChange={(e) => setReserveRM(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Expandable Optional Settings */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between font-semibold text-slate-700"
                >
                  <span>Optional Banking & Horizon Settings</span>
                  <span className="text-teal-800 font-medium">
                    {showAdvanced ? 'Hide' : 'Show'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 mb-1">Forecast Horizon:</label>
                      <select
                        value={horizon}
                        onChange={(e) => setHorizon(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="14">14 Days</option>
                        <option value="30">30 Days (Standard)</option>
                        <option value="60">60 Days</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Primary Operating Bank:</label>
                      <input
                        type="text"
                        defaultValue="Maybank (Malayan Banking Berhad)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  onClick={() => setMode('welcome')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomBiz}
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  Save & Launch Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
