import React, { useState } from 'react';
import { Leaf, ArrowRight, LockKeyhole } from 'lucide-react';
import { UserRole } from '../types/transition';
import { ROLE_LABELS } from '../auth/permissions';
import { useDemoAuth } from '../auth/DemoAuth';
import { BackButton } from './BackButton';

export const DemoLogin: React.FC = () => {
  const { signIn } = useDemoAuth();
  const [role, setRole] = useState<UserRole>('sme_owner');
  return <main className="gb-login"><section className="gb-login-brand"><div><Leaf size={28} /><strong>GreenBridge</strong></div><h1>A clearer path to<br />transition finance.</h1><p>Bring your business evidence, transition decisions and financing case together.</p><small>Data. Analysis. Action. Finance.</small></section><section className="gb-login-form"><div><LockKeyhole size={22} /><h2>Welcome to GreenBridge</h2><p>Sign in to your workspace.</p><form onSubmit={event => { event.preventDefault(); signIn(role); }}><label htmlFor="demo-account">Workspace account</label><select id="demo-account" value={role} onChange={event => setRole(event.target.value as UserRole)}>{(Object.keys(ROLE_LABELS) as UserRole[]).map(account => <option key={account} value={account}>{ROLE_LABELS[account]}</option>)}</select><p className="gb-login-account-note">{role === 'sme_owner' ? 'Review your company and authorize lender disclosures.' : role === 'finance_manager' ? 'Manage analysis and prepare financing drafts for owner review.' : 'Review approved packs using a sharing token supplied by the SME.'}</p><button className="gb-button gb-primary">Sign in <ArrowRight size={16} /></button></form><small>Demo workspace. Accounts are simulated; no password is required.</small></div><div className="gb-login-back"><BackButton /></div></section></main>;
};
