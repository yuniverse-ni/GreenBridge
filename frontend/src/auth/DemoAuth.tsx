import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types/transition';
import { ROLE_LABELS } from './permissions';

const SESSION_ROLE_KEY = 'greenbridge_demo_role';
const TOKEN_KEY = 'greenbridge_auth_token';
const USER_KEY = 'greenbridge_auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  title: string;
  role: UserRole;
  company_name: string;
  created_at?: string;
}

export interface Session {
  role: UserRole;
  name: string;
  email: string;
  user?: AuthUser;
}

interface DemoAuthContextType {
  session: Session | null;
  token: string | null;
  isLoading: boolean;
  signIn: (emailOrRole: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    title?: string;
    role: UserRole;
    company_name: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
}

const readStoredSession = (): { session: Session | null; token: string | null } => {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const userRaw = sessionStorage.getItem(USER_KEY);
    if (token && userRaw) {
      const user = JSON.parse(userRaw) as AuthUser;
      return {
        session: {
          role: user.role,
          name: user.name || ROLE_LABELS[user.role],
          email: user.email,
          user,
        },
        token,
      };
    }

    const legacyRole = sessionStorage.getItem(SESSION_ROLE_KEY) as UserRole;
    if (legacyRole && Object.hasOwn(ROLE_LABELS, legacyRole)) {
      return {
        session: {
          role: legacyRole,
          name: ROLE_LABELS[legacyRole],
          email: `${legacyRole}@apex.com`,
        },
        token: null,
      };
    }

    return { session: null, token: null };
  } catch {
    return { session: null, token: null };
  }
};

const DemoAuthContext = createContext<DemoAuthContextType | null>(null);

export const DemoAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = readStoredSession();
  const [session, setSession] = useState<Session | null>(initial.session);
  const [token, setToken] = useState<string | null>(initial.token);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Auto-verify token on mount if present
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.user) {
            const u = data.user as AuthUser;
            sessionStorage.setItem(USER_KEY, JSON.stringify(u));
            sessionStorage.setItem(SESSION_ROLE_KEY, u.role);
            setSession({
              role: u.role,
              name: u.name,
              email: u.email,
              user: u,
            });
          }
        })
        .catch(() => {
          // Token invalid or offline, keep cached session
        });
    }
  }, [token]);

  const signIn = async (emailOrRole: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      let email = emailOrRole.trim();
      let pwd = password || '';

      // Backward compatibility shortcuts for quick-fill / demo roles
      if (!pwd) {
        if (emailOrRole === 'sme_owner' || emailOrRole === 'owner@apex.com') {
          email = 'owner@apex.com';
          pwd = 'ApexGreen2026!';
        } else if (emailOrRole === 'finance_manager' || emailOrRole === 'finance@apex.com') {
          email = 'finance@apex.com';
          pwd = 'ApexGreen2026!';
        }
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pwd }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        return { success: false, error: data.detail || 'Invalid email or password.' };
      }

      const user = data.user as AuthUser;
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(SESSION_ROLE_KEY, user.role);

      setToken(data.token);
      setSession({
        role: user.role,
        name: user.name,
        email: user.email,
        user,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to Auth service.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    name: string;
    title?: string;
    role: UserRole;
    company_name: string;
  }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok || !resData.success) {
        return { success: false, error: resData.detail || 'Registration failed.' };
      }

      const user = resData.user as AuthUser;
      sessionStorage.setItem(TOKEN_KEY, resData.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(SESSION_ROLE_KEY, user.role);

      setToken(resData.token);
      setSession({
        role: user.role,
        name: user.name,
        email: user.email,
        user,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting to Auth service.' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('greenbridge_login_terms_agreed');
    setSession(null);
    setToken(null);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  return (
    <DemoAuthContext.Provider value={{ session, token, isLoading, signIn, register, signOut }}>
      {children}
    </DemoAuthContext.Provider>
  );
};

export function useDemoAuth() {
  const auth = useContext(DemoAuthContext);
  if (!auth) throw new Error('DemoAuthProvider required');
  return auth;
}
