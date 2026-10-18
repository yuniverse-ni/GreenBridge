import React from 'react';
import { useDemoAuth } from '../auth/DemoAuth';
import { ROLE_LABELS } from '../auth/permissions';
export const ProfileMenu: React.FC = () => {
  const { session, signOut } = useDemoAuth();
  if (!session) return null;
  return <details className="gb-profile-menu"><summary><span className="gb-profile-initial">{session.role === 'sme_owner' ? 'SO' : session.role === 'finance_manager' ? 'FM' : 'CR'}</span><span>{ROLE_LABELS[session.role]}</span></summary><div><button onClick={signOut}>Switch demo role</button><button onClick={signOut}>Sign out</button></div></details>;
};
