import React, { useState } from 'react';
import { TransitionProvider, useTransition } from './context/TransitionContext';
import { TransitionHeader } from './components/TransitionHeader';
import { OverviewView } from './components/OverviewView';
import { DataIngestionView } from './components/DataIngestionView';
import { CarbonAccountingView } from './components/CarbonAccountingView';
import { FinancialAnalysisView } from './components/FinancialAnalysisView';
import { DecarbonisationActionsView } from './components/DecarbonisationActionsView';
import { TransitionPlanView } from './components/TransitionPlanView';
import { TransitionCopilotView } from './components/TransitionCopilotView';
import { AuditEvidenceView } from './components/AuditEvidenceView';
import { FinancialTestSuiteView } from './components/FinancialTestSuiteView';
import { LegalGovernanceView } from './components/LegalGovernanceView';
import { LegalOnboardingModal } from './components/LegalOnboardingModal';
import { Leaf, ShieldCheck, Scale, Calculator } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activeTab, setActiveTab } = useTransition();

  // Legal Onboarding Modal State (Page 7 Law x Tech.pdf)
  const [showLegalModal, setShowLegalModal] = useState<boolean>(() => {
    return localStorage.getItem('transitionai_legal_accepted') !== 'true';
  });

  const handleAcceptLegal = () => {
    localStorage.setItem('transitionai_legal_accepted', 'true');
    setShowLegalModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Page 7 Legal Consent Onboarding Modal */}
      <LegalOnboardingModal
        isOpen={showLegalModal}
        onAccept={handleAcceptLegal}
      />

      {/* Sticky Top Header */}
      <TransitionHeader />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'ingestion' && <DataIngestionView />}
        {activeTab === 'baseline' && <CarbonAccountingView />}
        {activeTab === 'financials' && <FinancialAnalysisView />}
        {activeTab === 'actions' && <DecarbonisationActionsView />}
        {activeTab === 'transition-plan' && <TransitionPlanView />}
        {activeTab === 'copilot' && <TransitionCopilotView />}
        {activeTab === 'audit' && <AuditEvidenceView />}
        {activeTab === 'test-suite' && <FinancialTestSuiteView />}
        {activeTab === 'legal-governance' && <LegalGovernanceView />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">TransitionAI</span>
            <span>•</span>
            <span>AI Green Finance & Decarbonisation Copilot for Malaysian SMEs</span>
          </div>

          <div className="flex flex-wrap items-center space-x-4">
            <button
              onClick={() => setActiveTab('test-suite')}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-emerald-800 font-semibold transition"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              Regression Suite (Tests A–L)
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('legal-governance')}
              className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:text-emerald-800 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              PDPA & Terms Notice
            </button>
            <span>•</span>
            <button
              onClick={() => setShowLegalModal(true)}
              className="hover:text-slate-800 transition"
            >
              Review Consent
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <TransitionProvider>
      <AppContent />
    </TransitionProvider>
  );
}
