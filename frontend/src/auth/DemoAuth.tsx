import React, { createContext, useContext, useState } from 'react';
import { UserRole } from '../types/transition';
import { ROLE_LABELS } from './permissions';

const SESSION_KEY = 'greenbridge_demo_role';
interface Session { role: UserRole; name: string }
const readSession = (): Session | null => {
  try { const role = sessionStorage.getItem(SESSION_KEY) as UserRole; return Object.hasOwn(ROLE_LABELS, role) ? { role, name: ROLE_LABELS[role] } : null; } catch { return null; }
};
const DemoAuthContext = createContext<{ session: Session | null; signIn: (role: UserRole) => void; signOut: () => void } | null>(null);
export const DemoAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(readSession);
  const signIn = (role: UserRole) => {
    if (!Object.hasOwn(ROLE_LABELS, role)) throw new Error('Unknown demo account');
    sessionStorage.setItem(SESSION_KEY, role);
    setSession({ role, name: ROLE_LABELS[role] });
  };
  const signOut = () => { sessionStorage.removeItem(SESSION_KEY); setSession(null); window.history.replaceState(null, '', window.location.pathname + window.location.search); };
  return <DemoAuthContext.Provider value={{ session, signIn, signOut }}>{children}</DemoAuthContext.Provider>;
};
export function useDemoAuth() { const auth = useContext(DemoAuthContext); if (!auth) throw new Error('DemoAuthProvider required'); return auth; }
