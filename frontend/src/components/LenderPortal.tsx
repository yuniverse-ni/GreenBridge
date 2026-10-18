import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { ApprovedPack, loadApprovedPack } from '../agentData/approvedPack';
import { ProfileMenu } from './ProfileMenu';
import { BackButton } from './BackButton';
import { AccessDenied } from './AccessDenied';
import { Leaf, FileCheck2, Download } from 'lucide-react';
import { useWorkspaceRoute } from '../auth/useWorkspaceRoute';
import { canAccessPage } from '../auth/permissions';

export const ApprovedPackReview: React.FC<{ pack: ApprovedPack }> = ({ pack }) => {
  const exportApproved = () => {
    const doc = new jsPDF(); let y = 20;
    const line = (text: string) => { const lines = doc.splitTextToSize(text, 180); for (const part of lines) { if (y > 275) { doc.addPage(); y = 20; } doc.text(String(part), 15, y); y += 6; } };
    doc.setFontSize(11);
    line(pack.packageInfo.packageName); line(pack.packageInfo.companyName);
    line(`SME authorized by ${pack.packageInfo.authorizedBy}; expires ${pack.packageInfo.expiresAt}`);
    if (pack.executiveSummary) line(pack.executiveSummary);
    for (const [name, value] of Object.entries(pack)) if (name !== 'packageInfo' && name !== 'executiveSummary' && value !== null) { line(name); line(JSON.stringify(value, null, 2)); }
    doc.save('GreenBridge_Approved_Pack.pdf');
  };
  return <section className="gb-authorized-pack"><div className="gb-page-heading"><div><h1>{pack.packageInfo.packageName}</h1><p>{pack.packageInfo.companyName} | SME-authorized disclosure</p></div><button className="gb-button" onClick={exportApproved}><Download size={15} /> Download approved pack</button></div><p className="gb-authorized-notice">Authorized by {pack.packageInfo.authorizedBy} | Expires {pack.packageInfo.expiresAt}. Permission to disclose is not lender approval.</p>{pack.executiveSummary && <article className="gb-panel"><h2>Executive summary</h2><p>{pack.executiveSummary}</p></article>}{pack.financialSummary && <article className="gb-panel"><h2>Authorized financial summary</h2><dl className="gb-facts">{Object.entries(pack.financialSummary).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{typeof value === 'number' ? value.toLocaleString('en-MY', { maximumFractionDigits: 2 }) : String(value)}</dd></div>)}</dl></article>}{pack.carbonBaseline && <article className="gb-panel"><h2>Authorized carbon baseline</h2><dl className="gb-facts">{(['scope1TCO2e', 'scope2TCO2e', 'totalTCO2e'] as const).map(name => <div key={name}><dt>{name}</dt><dd>{(pack.carbonBaseline?.[name] === undefined ? 'Not supplied' : Number(pack.carbonBaseline[name]).toLocaleString('en-MY', { maximumFractionDigits: 2 }))} tCO2e</dd></div>)}</dl></article>}{pack.decarbonisationPlan && <article className="gb-panel"><h2>Authorized transition & financing case</h2>{pack.decarbonisationPlan.map(action => <div className="gb-authorized-action" key={action.id}><h3>{action.title}</h3><p>CAPEX: MYR {action.capex.toLocaleString()} | Annual savings: MYR {action.annualOpExSavings.toLocaleString()} | Carbon reduction: {action.annualCO2eReductionTons} tCO2e/year</p><p>Financing principal: MYR {action.financing.loanPrincipal.toLocaleString()} | Monthly repayment: MYR {action.financing.monthlyRepayment.toLocaleString()}</p></div>)}</article>}{pack.evidenceFiles && <article className="gb-panel"><h2>Authorized evidence</h2>{pack.evidenceFiles.map((file, i) => <p key={i}>{file.fileName} | {file.recordsCount} records | {file.uploadDate}</p>)}</article>}{!pack.carbonBaseline && <p>Carbon baseline not disclosed.</p>}{!pack.financialSummary && <p>Financial summary not disclosed.</p>}</section>;
};
export const LenderPortal: React.FC = () => {
  const [page, navigate] = useWorkspaceRoute('transition-plan');
  const [token, setToken] = useState(''); const [pack, setPack] = useState<ApprovedPack | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const openPack = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(''); setPack(null); try { setPack(await loadApprovedPack(token.trim())); } catch (e) { setError(e instanceof Error ? e.message : 'Pack unavailable'); } finally { setLoading(false); } };
  return <div className="gb-shell gb-lender-shell"><aside className="gb-sidebar"><div className="gb-brand"><Leaf size={22} /><span>GreenBridge<small>LENDER REVIEW</small></span></div><nav aria-label="Lender navigation"><button className="gb-nav-item is-active" onClick={() => navigate('transition-plan')}><FileCheck2 size={17} /><span>Approved Lender Packs</span></button></nav></aside><header className="gb-topbar"><div className="gb-header-page"><div className="gb-company"><strong>Lender / Credit Review</strong><span>Authorized packs only</span></div></div><ProfileMenu /></header><main className="gb-main"><div className="gb-page-content">{!canAccessPage('lender', page) ? <AccessDenied onReturn={() => navigate('transition-plan')} /> : <><form className="gb-token-form" onSubmit={openPack}><label htmlFor="pack-token">SME sharing token</label><input id="pack-token" value={token} onChange={event => { setToken(event.target.value); setPack(null); }} placeholder="Enter the token supplied by the SME" required autoComplete="off" /><button className="gb-button gb-primary" disabled={loading}>{loading ? 'Opening...' : 'Open approved pack'}</button></form>{error && <p role="alert" className="gb-auth-error">{error}</p>}{pack ? <ApprovedPackReview pack={pack} /> : <div className="gb-access-denied"><h1>Review an authorized financing case</h1><p>Ask the SME Owner for an approved sharing token. Internal company records are not available in this workspace.</p></div>}</>}</div><footer className="gb-workspace-footer"><div className="gb-footer-back"><BackButton /><span>GreenBridge</span></div></footer></main></div>;
};
