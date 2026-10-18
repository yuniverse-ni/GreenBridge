import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { can, canAccessPage } from '../src/auth/permissions';
import { DemoAuthProvider, useDemoAuth } from '../src/auth/DemoAuth';
import { TransitionProvider, useTransition } from '../src/context/TransitionContext';
import { loadApprovedPack } from '../src/agentData/approvedPack';
import { saveDraft, decideDraft, readDraft, readDisclosureAudit } from '../src/agentData/lenderDrafts';
import App from '../src/App';

function memoryStorage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() }; }
const session = memoryStorage(); const local = memoryStorage();
Object.defineProperty(globalThis, 'sessionStorage', { value: session });
Object.defineProperty(globalThis, 'localStorage', { value: local });
const location = { hash: '', pathname: '/', search: '' };
Object.defineProperty(globalThis, 'window', { value: { location, history: { replaceState: () => { location.hash = ''; } }, addEventListener: () => {}, removeEventListener: () => {} } });

function captureWorkspace(role: 'sme_owner' | 'finance_manager') {
  session.setItem('greenbridge_demo_role', role); location.hash = ''; location.pathname = '/';
  let context: ReturnType<typeof useTransition>;
  const Probe = () => { context = useTransition(); return null; };
  renderToString(<DemoAuthProvider><TransitionProvider><Probe /></TransitionProvider></DemoAuthProvider>);
  return context!;
}

test('permission matrix blocks lender workspace access and manager disclosure approval', () => {
  for (const page of ['overview', 'ingestion', 'baseline', 'financials', 'actions', 'copilot', 'audit']) {
    assert.equal(canAccessPage('sme_owner', page), true);
    assert.equal(canAccessPage('finance_manager', page), true);
    assert.equal(canAccessPage('lender', page), false);
  }
  assert.equal(canAccessPage('lender', 'transition-plan'), true);
  assert.equal(canAccessPage('sme_owner', 'unknown'), false);
  assert.equal(can('finance_manager', 'prepare_pack'), true);
  assert.equal(can('finance_manager', 'approve_disclosure'), false);
  assert.equal(can('lender', 'manage_data'), false);
});

test('manager service action refuses sharing before any network request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Network must not run'); };
  const context = captureWorkspace('finance_manager');
  assert.equal(context.currentRole, 'finance_manager');
  assert.equal('setCurrentRole' in context, false);
  await assert.rejects(context.createLenderPackage('Unauthorized'), /Access denied/);
  assert.equal(calls, 0);
});

test('only owner can call existing sharing API', async () => {
  const urls: string[] = [];
  globalThis.fetch = async input => {
    urls.push(String(input));
    return new Response(JSON.stringify(String(input).endsWith('/create') ? { package: { id: 'APPROVED' } } : { profile: { id: 'COMPANY' } }), { status: 200 });
  };
  const owner = captureWorkspace('sme_owner');
  await owner.createLenderPackage('Approved', { includeCarbonBaseline: false }, 'Owner approved');
  assert.deepEqual(urls, ['/api/transition/lender-package/create', '/api/transition/state']);
});

test('draft preparation stays local and company-scoped; only owner decisions succeed', () => {
  local.clear();
  const input = { companyId: 'COMPANY-A', reportingYear: 2024, packageName: 'Manager proposal', disclosures: { includeCarbonBaseline: false }, fingerprint: 'snapshot' };
  const draft = saveDraft('finance_manager', input);
  assert.equal(draft.status, 'DRAFT');
  assert.equal(readDraft('COMPANY-B'), null);
  assert.throws(() => decideDraft('finance_manager', draft, 'APPROVED'), /Access denied/);
  assert.throws(() => saveDraft('lender', input), /Access denied/);
  assert.throws(() => decideDraft('sme_owner', draft, 'REJECTED', ''), /reason/);
  const rejected = decideDraft('sme_owner', draft, 'REJECTED', 'Need supplier quotations');
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(readDisclosureAudit('COMPANY-A').length, 2);
  assert.equal(readDisclosureAudit('COMPANY-B').length, 0);
});

const rawPack = () => ({ packageInfo: { id: 'PKG', packageName: 'Authorized pack', companyName: 'SME', createdDate: '2024-01-01', authorizedBy: 'SME Owner', expiresAt: '2099-12-31', disclosures: { includeExecutiveSummary: true, includeCarbonBaseline: false, includeFinancialSummary: false, includeDecarbonisationPlan: false, includeEvidenceDocuments: false } }, executiveSummary: 'Approved summary', carbonBaseline: { totalTCO2e: 999 }, financialSummary: { annualRevenue: 999 }, decarbonisationPlan: [{ id: 'PRIVATE' }], evidenceFiles: [{ fileName: 'PRIVATE' }], greenLoanEligibility: { private: true } });

test('token loader uses only token endpoint and excludes undisclosed sections and extra fields', async () => {
  const urls: string[] = [];
  globalThis.fetch = async input => { urls.push(String(input)); return new Response(JSON.stringify(rawPack()), { status: 200 }); };
  const result = await loadApprovedPack('lp_APPROVED');
  assert.deepEqual(urls, ['/api/transition/lender-package/lp_APPROVED']);
  assert.equal(result.executiveSummary, 'Approved summary');
  assert.equal(result.carbonBaseline, null); assert.equal(result.financialSummary, null);
  assert.equal(result.decarbonisationPlan, null); assert.equal(result.evidenceFiles, null);
  assert.equal('greenLoanEligibility' in result, false);
  const markup = JSON.stringify(result);
  assert.equal(markup.includes('PRIVATE'), false);
});

test('unapproved, expired, absent, and invalid-token packs cannot be opened', async () => {
  for (const kind of ['unshared', 'expired', 'unauthorized']) {
    const raw = rawPack();
    if (kind === 'unshared') Object.assign(raw.packageInfo, { isShared: false });
    if (kind === 'expired') raw.packageInfo.expiresAt = '2000-01-01';
    if (kind === 'unauthorized') raw.packageInfo.authorizedBy = '';
    globalThis.fetch = async () => new Response(JSON.stringify(raw), { status: 200 });
    await assert.rejects(loadApprovedPack('lp_TEST'), /authorization|expired/);
  }
  globalThis.fetch = async () => { throw new Error('Should not request invalid token'); };
  await assert.rejects(loadApprovedPack('../../financial-data'), /valid sharing token/);
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  await assert.rejects(loadApprovedPack('lp_MISSING'), /unavailable/);
});

test('signed-out view does not mount the workspace; lender view is isolated and direct routes denied', () => {
  session.clear(); location.hash = ''; location.pathname = '/';
  const signedOut = renderToString(<App />);
  assert.match(signedOut, /Sign in to your workspace/);
  assert.doesNotMatch(signedOut, /Data &amp; Documents/);
  session.setItem('greenbridge_demo_role', 'lender');
  const lender = renderToString(<App />);
  assert.match(lender, /SME sharing token/);
  assert.doesNotMatch(lender, /Financial Analysis|Load sample data|SME disclosure approval/);
  location.hash = '#/financials';
  assert.match(renderToString(<App />), /Access denied/);
  location.hash = ''; location.pathname = '/copilot';
  assert.match(renderToString(<App />), /Access denied/);
  location.pathname = '/';
});

test('profile switching clears demo session instead of mutating workspace role', () => {
  session.setItem('greenbridge_demo_role', 'finance_manager'); location.hash = '#/financials';
  let auth: ReturnType<typeof useDemoAuth>;
  const Probe = () => { auth = useDemoAuth(); return null; };
  renderToString(<DemoAuthProvider><Probe /></DemoAuthProvider>);
  auth!.signOut();
  assert.equal(session.getItem('greenbridge_demo_role'), null);
  assert.equal(location.hash, '');
});


test('manager pack screen prepares drafts without owner authorization controls', () => {
  session.setItem('greenbridge_demo_role', 'finance_manager');
  location.hash = '#/transition-plan'; location.pathname = '/';
  const markup = renderToString(<App />);
  assert.match(markup, /Save draft for SME Owner/);
  assert.doesNotMatch(markup, /Review &amp; Generate Lender Pack|Approve specified disclosure|Reject disclosure|Viewing as/);
  session.setItem('greenbridge_demo_role', 'sme_owner');
  const owner = renderToString(<App />);
  assert.match(owner, /Review &amp; Generate Lender Pack/);
  location.hash = '';
});
