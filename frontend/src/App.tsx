import React, { useState } from 'react';
import { DemoAuthProvider, useDemoAuth } from './auth/DemoAuth';
import { canAccessPage } from './auth/permissions';
import { DemoLogin } from './components/DemoLogin';
import { LenderPortal } from './components/LenderPortal';
import { AccessDenied } from './components/AccessDenied';
import { BackButton } from './components/BackButton';
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


const AppContent: React.FC = () => {
  const { activeTab, setActiveTab, currentRole } = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`gb-shell ${collapsed ? "gb-collapsed" : ""}`}>
      <TransitionHeader collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {/* Main Container */}
      <main id="workspace" className={`gb-main ${activeTab === "overview" || activeTab === "copilot" || activeTab === "transition-plan" || activeTab === "actions" ? "gb-main-dashboard" : ""} ${activeTab === "transition-plan" ? "gb-main-lender-pack" : ""}`}>
        <div className={`gb-page-content ${['overview', 'copilot', 'actions'].includes(activeTab) ? 'gb-page-content-dashboard' : ''}`}>
        {!canAccessPage(currentRole, activeTab) ? <AccessDenied onReturn={() => setActiveTab('overview')} /> : <>
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
        </>}
        </div>
      <footer className="gb-workspace-footer">
        <div className="gb-footer-back"><BackButton /><span>GreenBridge</span></div>
        <nav aria-label="Workspace utilities">
          <button aria-current={activeTab === 'legal-governance' ? 'page' : undefined} onClick={() => setActiveTab('legal-governance')}>Legal &amp; Privacy</button>
        </nav>
      </footer>
      </main>


    </div>
  );
};

const SignedInApp: React.FC = () => {
  const { session, signOut } = useDemoAuth();
  const [hasAgreed, setHasAgreed] = useState<boolean>(() => {
    return sessionStorage.getItem('greenbridge_login_terms_agreed') === 'true';
  });

  React.useEffect(() => {
    if (!session) {
      setHasAgreed(false);
    } else {
      setHasAgreed(sessionStorage.getItem('greenbridge_login_terms_agreed') === 'true');
    }
  }, [session]);

  if (!session) return <DemoLogin />;

  const content = session.role === 'lender' ? (
    <LenderPortal key="lender" />
  ) : (
    <TransitionProvider key={session.role}>
      <AppContent />
    </TransitionProvider>
  );

  if (!hasAgreed) {
    return (
      <>
        {content}
        <LegalOnboardingModal
          isOpen={true}
          onClose={signOut}
          title="Terms & Conditions and Privacy Notice"
          subtitle="Please review and agree to the platform terms and privacy notice to continue using GreenBridge."
          onAccept={() => {
            sessionStorage.setItem('greenbridge_login_terms_agreed', 'true');
            localStorage.setItem('transitionai_legal_accepted', 'true');
            setHasAgreed(true);
          }}
        />
      </>
    );
  }

  return content;
};

export default function App() {
  return <DemoAuthProvider><SignedInApp /></DemoAuthProvider>;
}
