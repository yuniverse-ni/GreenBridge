import React from 'react';
import { useDemoAuth } from '../auth/DemoAuth';
import { ROLE_LABELS } from '../auth/permissions';
import { LogOut, User } from 'lucide-react';

export const ProfileMenu: React.FC = () => {
  const { session, signOut } = useDemoAuth();
  if (!session) return null;

  const initials = session.user?.name
    ? session.user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : session.role === 'sme_owner' ? 'SO' : 'FM';

  const displayName = session.user?.name || session.name || ROLE_LABELS[session.role];
  const roleLabel = ROLE_LABELS[session.role];

  return (
    <details className="gb-profile-menu">
      <summary className="flex items-center gap-2 cursor-pointer select-none">
        <span className="gb-profile-initial font-bold text-emerald-800">
          {initials}
        </span>
        <div className="flex flex-col text-left leading-tight hidden sm:flex">
          <span className="text-xs font-semibold text-slate-800">{displayName}</span>
          <span className="text-[10px] text-emerald-700 font-medium">{roleLabel}</span>
        </div>
      </summary>
      <div className="p-2 space-y-1 min-w-[200px]">
        <div className="px-3 py-2 border-b border-slate-100 mb-1">
          <p className="text-xs font-bold text-slate-900">{displayName}</p>
          <p className="text-[11px] text-slate-500 truncate">{session.user?.email || session.email}</p>
          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">{roleLabel}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md transition"
        >
          <User size={13} />
          <span>Switch Account</span>
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition"
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </div>
    </details>
  );
};
