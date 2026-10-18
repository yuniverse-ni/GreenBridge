import React from 'react';
import { useTransition } from '../context/TransitionContext';
import { canAccessPage } from '../auth/permissions';
import { ProfileMenu } from './ProfileMenu';
import { Leaf, LayoutDashboard, Database, Coins, Lightbulb, MessageSquare, FileCheck2, FileText, PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react';

interface Props { collapsed: boolean; onToggle: () => void }

export const TransitionHeader: React.FC<Props> = ({ collapsed, onToggle }) => {
  const {
    activeTab,
    setActiveTab,
    profile,
    currentRole,
    clearWorkspace,
    isLoading,
    pythonEngineStatus,
    checkPythonEngine
  } = useTransition();
  const items = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'ingestion', label: 'Data & Documents', icon: Database },
    { id: 'baseline', label: 'Carbon Analysis', icon: Leaf },
    { id: 'financials', label: 'Financial Analysis', icon: Coins },
    { id: 'actions', label: 'Transition Actions', icon: Lightbulb },
    { id: 'copilot', label: 'AI Copilot', icon: MessageSquare },
    { id: 'transition-plan', label: 'Lender Pack', icon: FileCheck2 },
  ] as const;
  return <>
    <a href="#workspace" className="gb-skip">Skip to workspace</a>
    <aside className="gb-sidebar" aria-label="Main navigation">
      <div className="gb-brand"><Leaf size={22} /><span>GreenBridge<small>TRANSITION FINANCE</small></span></div>
      <div className="gb-nav-caption">WORKFLOW</div>
      <nav aria-label="Transition workflow">{items.filter(item => canAccessPage(currentRole, item.id)).map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return <button key={id} className={`gb-nav-item ${active ? 'is-active' : ''}`} title={label} aria-current={active ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon size={17} /><span>{label}</span></button>;
      })}</nav>
      <div className="gb-sidebar-bottom">
        <div className="gb-nav-caption gb-governance-caption">GOVERNANCE</div>
        <nav aria-label="Governance" hidden={!canAccessPage(currentRole, 'audit')}>
          <button className={`gb-nav-item ${activeTab === 'audit' ? 'is-active' : ''}`} title="Audit Trail" aria-current={activeTab === 'audit' ? 'page' : undefined} onClick={() => setActiveTab('audit')}><FileText size={16} /><span>Audit Trail</span></button>
        </nav>
        <button className="gb-nav-item gb-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>Collapse sidebar</span></button>
      </div>
    </aside>
    <header className="gb-topbar">
      <div className="gb-header-page"><div className="gb-company"><strong>{profile.name || 'SME Workspace'}</strong><span>FY {profile.reportingYear} | {profile.currency} | {profile.gridRegion || 'Malaysia'}</span></div></div>
      <div className="gb-header-actions">
        <div
          role="button"
          tabIndex={0}
          onClick={() => checkPythonEngine()}
          title={pythonEngineStatus.connected ? `Python FastAPI Engine Connected (${pythonEngineStatus.backendUrl}) - Click to refresh` : `Python FastAPI Offline (${pythonEngineStatus.backendUrl}) - Click to retry`}
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '9999px',
            background: pythonEngineStatus.connected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: pythonEngineStatus.connected ? '#15803d' : '#b91c1c',
            border: `1px solid ${pythonEngineStatus.connected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            userSelect: 'none'
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: pythonEngineStatus.connected ? '#22c55e' : '#ef4444'
            }}
          />
          <span>{pythonEngineStatus.connected ? 'Python :8000' : 'Engine Offline'}</span>
        </div>
        <ProfileMenu />
        <button className="gb-button gb-icon-button" title="Reset workspace" aria-label="Reset workspace" disabled={isLoading} onClick={clearWorkspace}><RotateCcw size={15} /></button>
      </div>
    </header>
  </>;
};
