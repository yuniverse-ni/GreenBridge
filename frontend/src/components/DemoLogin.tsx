import React, { useState } from 'react';
import { Leaf, ArrowRight, LockKeyhole, Eye, EyeOff, ShieldCheck, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { UserRole } from '../types/transition';
import { useDemoAuth } from '../auth/DemoAuth';
import { BackButton } from './BackButton';

export const DemoLogin: React.FC = () => {
  const { signIn, register, isLoading } = useDemoAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('owner@apex.com');
  const [password, setPassword] = useState<string>('ApexGreen2026!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Registration state
  const [regName, setRegName] = useState<string>('');
  const [regCompany, setRegCompany] = useState<string>('Apex Precision Engineering Sdn Bhd');
  const [regRole, setRegRole] = useState<UserRole>('sme_owner');

  const handleQuickFill = (targetRole: 'sme_owner' | 'finance_manager') => {
    setError(null);
    if (targetRole === 'sme_owner') {
      setEmail('owner@apex.com');
      setPassword('ApexGreen2026!');
    } else {
      setEmail('finance@apex.com');
      setPassword('ApexGreen2026!');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    const res = await signIn(email.trim(), password);
    if (!res.success) {
      setError(res.error || 'Invalid email or password.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regName.trim() || !email.trim() || !password || !regCompany.trim()) {
      setError('Please fill in all registration fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    const res = await register({
      email: email.trim(),
      password,
      name: regName.trim(),
      company_name: regCompany.trim(),
      role: regRole,
    });

    if (!res.success) {
      setError(res.error || 'Registration failed.');
    }
  };

  return (
    <main className="gb-login">
      {/* Left Brand Showcase Banner */}
      <section className="gb-login-brand">
        <div>
          <Leaf size={28} />
          <strong>GreenBridge</strong>
        </div>
        <h1>
          A clearer path to<br />transition finance.
        </h1>
        <p>
          Secure SME green finance orchestration. Powered by SQLite ACID persistence,
          deterministic carbon baselines, and Bank Negara Malaysia (BNM LCTF) alignment.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs text-emerald-200 bg-emerald-950/40 p-3 rounded-lg border border-emerald-800/60 max-w-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>PBKDF2 Salted Hashing &amp; Role-Based Access Control (RBAC)</span>
        </div>
        <small className="mt-auto pt-10 text-emerald-300/70">
          Data. Analysis. Action. Finance. • Zero-Database Setup (Embedded SQLite)
        </small>
      </section>

      {/* Right Login / Registration Form */}
      <section className="gb-login-form">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 mb-2">
            <LockKeyhole size={22} />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Enterprise Portal
            </span>
          </div>

          <h2>{mode === 'login' ? 'Welcome to GreenBridge' : 'Create SME Account'}</h2>
          <p>
            {mode === 'login'
              ? 'Sign in to access your company transition workspace.'
              : 'Register an authorized corporate account for your enterprise.'}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 my-4 border border-slate-200">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register</span>
            </button>
          </div>

          {/* Quick-Fill Demo Presets (for evaluators and testing) */}
          {mode === 'login' && (
            <div className="mb-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
              <span className="block text-[11px] font-bold text-emerald-900 mb-1.5">
                Role
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('sme_owner')}
                  className="flex-1 py-1.5 px-2 bg-white hover:bg-emerald-100/80 border border-emerald-300 rounded text-xs font-semibold text-emerald-900 transition text-center shadow-2xs"
                >
                  SME Owner
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('finance_manager')}
                  className="flex-1 py-1.5 px-2 bg-white hover:bg-emerald-100/80 border border-emerald-300 rounded text-xs font-semibold text-emerald-900 transition text-center shadow-2xs"
                >
                  Finance Manager
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white pr-9 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <span>Authenticating...</span> : <span>Sign In to Workspace</span>}
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          )}

          {/* Registration Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Dato' Ir. Tan Beng Huat"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Enterprise Name
                </label>
                <input
                  type="text"
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  placeholder="e.g. Apex Precision Engineering Sdn Bhd"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Role
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="sme_owner">SME Owner / Managing Director</option>
                  <option value="finance_manager">Finance Manager / Head of Accounts</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (min 6 chars)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create secure password"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <span>Registering...</span> : <span>Create Account &amp; Sign In</span>}
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 text-center">
            <small className="text-[11px] text-slate-500">
              Secured by SQLite prepared statements &amp; PBKDF2 cryptography.
            </small>
          </div>
        </div>

        <div className="gb-login-back">
          <BackButton />
        </div>
      </section>
    </main>
  );
};
