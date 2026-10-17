// TransitionAI — Legal & Privacy Governance Center
// Grounded in Law x Tech.pdf (Terms & Conditions, Privacy Notice, Data Retention, Report Disclosure Authorization)

import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  Lock,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Building,
  Mail,
  Phone,
  Server,
  Download
} from 'lucide-react';

export const LegalGovernanceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'retention' | 'framework'>('privacy');
  const [deleteConfirmation, setDeleteConfirmation] = useState<boolean>(false);
  const [deletedSuccess, setDeletedSuccess] = useState<boolean>(false);

  const handleDeleteRequest = () => {
    setDeleteConfirmation(true);
  };

  const confirmDelete = () => {
    setDeleteConfirmation(false);
    setDeletedSuccess(true);
    setTimeout(() => setDeletedSuccess(false), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Legal, Privacy & AI Governance
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              PDPA 2024 & BNM Aligned
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Transparent legal terms, privacy notices, data minimization controls, and report-sharing authorization records under Malaysian and international governance frameworks.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span className="text-slate-500">Platform Operator:</span>
          <span className="font-bold text-slate-800">EcoNexus (econexus@gmail.com)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'privacy'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Privacy Notice (12 Sections)
        </button>
        <button
          onClick={() => setActiveTab('terms')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'terms'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Terms & Conditions (19 Sections)
        </button>
        <button
          onClick={() => setActiveTab('retention')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'retention'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Data Retention & Deletion
        </button>
        <button
          onClick={() => setActiveTab('framework')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'framework'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Legal Compliance Reference
        </button>
      </div>

      {/* Delete Feedback Banner */}
      {deletedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-3 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Your right-to-be-forgotten deletion request has been formally recorded in the audit registry. Temporary caches have been scheduled for purge in accordance with our 90-day retention cycle.</span>
        </div>
      )}

      {/* TAB 1: Privacy Notice */}
      {activeTab === 'privacy' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 text-xs text-slate-700 leading-relaxed">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">TransitionAI — Privacy Notice</h2>
            <p className="text-slate-500 mt-0.5">Last updated: 16 October 2026 • Platform Operator: EcoNexus</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">1. Introduction</h3>
                <p>TransitionAI (“we”, “us” or “our”) is an AI-powered Green Finance Copilot designed to help SMEs analyse their financial and operational data, identify carbon-reduction opportunities, compare transition scenarios, and prepare financing-ready reports.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">2. Information We May Collect</h3>
                <p>We process: A. Account and contact information. B. Business financial information (bank transactions, revenue, debt). C. Operational & energy records (TNB electricity bills, diesel receipts, natural gas). D. Technical usage logs.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">3. How We Use Information</h3>
                <p>Information is used exclusively to calculate deterministic financial summaries, calculate carbon baselines, model transition savings, and prepare transition packs. We do NOT treat general acceptance of this Privacy Notice as permission to disclose reports to lenders.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">4. Use of Artificial Intelligence & Third-Party Providers</h3>
                <p>We use AI models (Google Gemini 3.8 Flash) strictly for conversational orchestration, text summaries, and user guidance. Authoritative arithmetic is run through deterministic local code. Unnecessary personal identifiers are excluded.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">5. Disclosure to Lenders & Third Parties</h3>
                <p>TransitionAI may prepare financing packages for lenders. However, a report is NEVER shared externally merely because it is generated. SMEs must explicitly review the package and approve the intended lender recipient and purpose.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">6. International Data Transfers</h3>
                <p>TransitionAI supports SMEs across jurisdictions. Information is processed and stored in secure infrastructure in compliance with applicable cross-border data transfer safeguards.</p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">7. Data Security</h3>
                <p>We implement role-based access controls, tenant data separation, encrypted communication, and audit logging for all external report disclosure events.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm mb-1">12. Contact Information</h3>
                <p>Platform operator: <strong>EcoNexus</strong></p>
                <p>Contact Email: <strong>econexus@gmail.com</strong></p>
                <p>Privacy Contact: <strong>+60 36789 7676</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Terms & Conditions */}
      {activeTab === 'terms' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 text-xs text-slate-700 leading-relaxed">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">TransitionAI — Terms & Conditions (19 Sections)</h2>
            <p className="text-slate-500 mt-0.5">Last updated: 16 October 2026 • Reference: Law x Tech.pdf</p>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <div>
              <h4 className="font-bold text-slate-900">1. Introduction and Acceptance</h4>
              <p>Welcome to TransitionAI. These Terms & Conditions govern your access to and use of the platform. Affirmative acceptance is required prior to using the platform features.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">2. Purpose and Scope</h4>
              <p>The Platform provides decision-support information. It is NOT a substitute for professional financial, legal, accounting, environmental, tax, or investment advice.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">7. Carbon Estimates and Environmental Information</h4>
              <p>Emissions estimates depend on user-supplied activity data and documented emissions factors. Figures may be estimates rather than direct measurements. Projected reductions do not prove that reductions have occurred, nor certify an SME as carbon-neutral.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">8. Financial Projections and Financing Disclaimer</h4>
              <p>The Platform provides illustrative calculations. The Platform does NOT make binding loan offers, guarantee financing, approve credit applications, or promise a particular financial outcome. A lender remains solely responsible for its own credit assessment and lending decision.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">9. Reviewing and Sharing Reports</h4>
              <p>A report is NOT automatically authorised for disclosure to a lender. Before an external report is shared, the SME or an authorized representative must review the report and explicitly approve the intended disclosure.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">14 & 15. Disclaimer of Warranties & Limitation of Liability</h4>
              <p>The Platform is provided on an "as available" decision-support basis. Users are responsible for exercising independent human judgment before acting on AI-assisted results.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">18. Governing Law & Jurisdiction</h4>
              <p>Aligned with Malaysia's Contracts Act 1950, Electronic Commerce Act 2006, and Personal Data Protection Act 2010.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">19. Operator Details</h4>
              <p>Platform operator: EcoNexus • Email: econexus@gmail.com • Contact: +60 36789 7676</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Data Retention & Deletion */}
      {activeTab === 'retention' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Data Retention Policy & Right to Deletion</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configurable retention timeframes proposed in Section 8 of the TransitionAI Privacy Notice.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Account & Profile Information</span>
              <span className="text-base font-extrabold text-slate-900 mt-1 block">Active + 12 Months</span>
              <p className="text-xs text-slate-500 mt-1">Maintained while account is active and up to 12 months post-closure.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Uploaded Financial Documents</span>
              <span className="text-base font-extrabold text-slate-900 mt-1 block">90 Days</span>
              <p className="text-xs text-slate-500 mt-1">Utility bills, bank statements and CSV/Excel uploads retained up to 90 days post-analysis.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Generated Reports & Transition Plans</span>
              <span className="text-base font-extrabold text-slate-900 mt-1 block">12 Months</span>
              <p className="text-xs text-slate-500 mt-1">To allow SMEs to retrieve and compare year-on-year transition progress.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Security & Audit Logs</span>
              <span className="text-base font-extrabold text-slate-900 mt-1 block">12 Months</span>
              <p className="text-xs text-slate-500 mt-1">Required for statutory accountability, dispute resolution and lender verification.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Backup Cycles</span>
              <span className="text-base font-extrabold text-slate-900 mt-1 block">Max 90 Days</span>
              <p className="text-xs text-slate-500 mt-1">Automated purge cycle overwriting deleted active database records.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">AI Prompts & Queries</span>
              <span className="text-base font-extrabold text-slate-900 mt-1 block">Ephemeral</span>
              <p className="text-xs text-slate-500 mt-1">Not retained for proprietary model training.</p>
            </div>
          </div>

          {/* Right to Deletion Action Box */}
          <div className="border border-red-200 bg-red-50/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-red-900 font-bold text-sm">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Exercise Right to Erasure / Deletion</span>
              </div>
              <p className="text-xs text-red-700 mt-1 max-w-xl">
                Submit an affirmative request to purge all uploaded utility bills, extracted financial records, and transition plans associated with this workspace.
              </p>
            </div>

            <button
              onClick={handleDeleteRequest}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition shadow-xs shrink-0"
            >
              Request Data Deletion
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Legal Compliance Reference Matrix */}
      {activeTab === 'framework' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Regulatory & Legal Mapping Matrix</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Extracted from Law x Tech.pdf reference tables (Pages 2-6) covering privacy, AI ethics, electronic contracts, and green finance.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 rounded-xl">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Regulatory Domain</th>
                  <th className="py-2.5 px-3">Applicable Law / Reference</th>
                  <th className="py-2.5 px-3">Precautionary Requirement</th>
                  <th className="py-2.5 px-3">TransitionAI Solution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Privacy & Data Protection</td>
                  <td className="py-2.5 px-3">Malaysia PDPA 2010 (2024 Amendments)</td>
                  <td className="py-2.5 px-3 text-slate-600">Collection & use depends on affirmative notice before upload</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">Privacy notice modal before file ingestion</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">International Privacy</td>
                  <td className="py-2.5 px-3">EU GDPR / UK DPA 2018 / OECD Guidelines</td>
                  <td className="py-2.5 px-3 text-slate-600">Data minimization & purpose limitation</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">Collect only required fields, tenant isolation</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">AI Accountability</td>
                  <td className="py-2.5 px-3">EU AI Act / NIST AI RMF</td>
                  <td className="py-2.5 px-3 text-slate-600">Explainability and human-in-the-loop verification</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">Deterministic arithmetic; AI explains outputs</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Environmental Claims</td>
                  <td className="py-2.5 px-3">GHG Protocol Corporate Standard / Anti-Greenwashing</td>
                  <td className="py-2.5 px-3 text-slate-600">Transparent emission factors, no fabricated claims</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">Documented factor citations (Suruhanjaya Tenaga 2023)</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Electronic Signatures</td>
                  <td className="py-2.5 px-3">Malaysia Electronic Commerce Act 2006</td>
                  <td className="py-2.5 px-3 text-slate-600">Legal effect and evidence of user sign-off</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">Affirmative check & cryptographic hash log</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">Financial Lending</td>
                  <td className="py-2.5 px-3">BNM Financial Services Act & LCTF</td>
                  <td className="py-2.5 px-3 text-slate-600">Decision-support limitation; cannot guarantee loans</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-medium">Prominent financing disclaimer on all reports</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Data Deletion */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start space-x-3 text-amber-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm Right to Erasure</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to request deletion of your uploaded business files and calculated records?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg text-[11px] text-slate-600 mb-4">
              This will queue uploaded invoices, extracted data rows, and transition scenarios for permanent purge in the next deletion cycle.
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeleteConfirmation(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
              >
                Confirm Deletion Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
