// TransitionAI — Legal Onboarding & Terms/Privacy Consent Modal
// Faithfully implements the UI design from Page 7 and the full text from Pages 9-21 of Law x Tech.pdf

import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  X,
  ExternalLink,
  Lock,
  AlertTriangle,
  ArrowDown
} from 'lucide-react';

interface LegalOnboardingModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
}

export const LegalOnboardingModal: React.FC<LegalOnboardingModalProps> = ({
  isOpen,
  onAccept,
  onClose,
  title = "Terms & Conditions and Privacy Notice",
  subtitle = "Please review and agree to the platform terms and privacy notice to continue using GreenBridge."
}) => {
  const [agreedTerms, setAgreedTerms] = useState<boolean>(false);
  const [acknowledgedPrivacy, setAcknowledgedPrivacy] = useState<boolean>(false);
  const [activeDoc, setActiveDoc] = useState<'none' | 'terms' | 'privacy'>('none');
  const [termsScrolledEnd, setTermsScrolledEnd] = useState<boolean>(false);
  const [privacyScrolledEnd, setPrivacyScrolledEnd] = useState<boolean>(false);
  const docScrollRef = useRef<HTMLDivElement>(null);

  const canAcceptDoc = activeDoc === 'terms' ? termsScrolledEnd : activeDoc === 'privacy' ? privacyScrolledEnd : false;

  const handleDocScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 30) {
      if (activeDoc === 'terms') setTermsScrolledEnd(true);
      if (activeDoc === 'privacy') setPrivacyScrolledEnd(true);
    }
  };

  useEffect(() => {
    if (activeDoc !== 'none' && docScrollRef.current) {
      docScrollRef.current.scrollTop = 0;
      const { scrollHeight, clientHeight } = docScrollRef.current;
      if (scrollHeight <= clientHeight + 20) {
        if (activeDoc === 'terms') setTermsScrolledEnd(true);
        if (activeDoc === 'privacy') setPrivacyScrolledEnd(true);
      }
    }
  }, [activeDoc]);

  if (!isOpen) return null;

  const canContinue = agreedTerms && acknowledgedPrivacy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-label={title} className="gb-approval-modal bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 sm:p-8 animate-in fade-in duration-200 relative">
        {onClose && <button type="button" className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition" aria-label="Cancel consent review" onClick={onClose}><X size={18} /></button>}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {subtitle}
          </p>
        </div>

        {/* Document Review Cards (Directly matching Page 7 layout) */}
        <div className="space-y-3 mb-6">
          {/* Card 1: Terms & Conditions */}
          <div
            onClick={() => setActiveDoc('terms')}
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50/70 cursor-pointer transition group"
          >
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-50 group-hover:text-emerald-700">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                  Terms & Conditions
                </h4>
                <p className="text-[11px] text-slate-500">The rules for using TransitionAI</p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 group-hover:text-emerald-700">
              <span className="text-[10px] uppercase font-semibold">19 Sections</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Privacy Notice */}
          <div
            onClick={() => setActiveDoc('privacy')}
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-slate-50/70 cursor-pointer transition group"
          >
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-50 group-hover:text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                  Privacy Notice
                </h4>
                <p className="text-[11px] text-slate-500">How your business and personal data is handled</p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 group-hover:text-emerald-700">
              <span className="text-[10px] uppercase font-semibold">12 Sections</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Acceptance Checkboxes */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 mb-6">
          <p className="text-[11px] text-slate-500 font-medium">
            Please open, scroll to the bottom, and accept both documents before continuing.
          </p>

          <label className="flex items-start space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => {
                if (!termsScrolledEnd && e.target.checked) {
                  setActiveDoc('terms');
                  return;
                }
                setAgreedTerms(e.target.checked);
              }}
              className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-700 select-none">
              I agree to the <button type="button" onClick={() => setActiveDoc('terms')} className="text-emerald-700 font-semibold underline">Terms & Conditions</button>.
              {!termsScrolledEnd && <span className="ml-1 text-[10px] text-amber-700 font-medium">(click to review & scroll)</span>}
            </span>
          </label>

          <label className="flex items-start space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledgedPrivacy}
              onChange={(e) => {
                if (!privacyScrolledEnd && e.target.checked) {
                  setActiveDoc('privacy');
                  return;
                }
                setAcknowledgedPrivacy(e.target.checked);
              }}
              className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-700 select-none">
              I acknowledge that I have read the <button type="button" onClick={() => setActiveDoc('privacy')} className="text-emerald-700 font-semibold underline">Privacy Notice</button>.
              {!privacyScrolledEnd && <span className="ml-1 text-[10px] text-amber-700 font-medium">(click to review & scroll)</span>}
            </span>
          </label>
        </div>

        {/* Continue Button */}
        <button
          onClick={onAccept}
          disabled={!canContinue}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <span>Continue to Dashboard</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <p className="text-[10px] text-slate-400 text-center mt-3">
          Decision-support platform • Operator: EcoNexus • Contact: econexus@gmail.com
        </p>
      </div>

      {/* Document Detail Viewer Modal */}
      {activeDoc !== 'none' && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeDoc === 'terms' ? 'TransitionAI — Terms & Conditions' : 'TransitionAI — Privacy Notice'}
                </h3>
                <p className="text-xs text-slate-500">
                  Last updated: 16 October 2026 • Platform Operator: EcoNexus
                </p>
              </div>
              <button
                onClick={() => setActiveDoc('none')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div
              ref={docScrollRef}
              onScroll={handleDocScroll}
              className="p-6 overflow-y-auto text-xs leading-relaxed text-slate-700 space-y-4 font-sans select-text max-h-[60vh]"
            >
              {activeDoc === 'terms' ? (
                <>
                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">1. Introduction and Acceptance</h4>
                    <p>Before sharing your Lender Pack, an AI-assisted green-finance support tool designed to help small and medium-sized enterprises (“SMEs”) understand their financial and operational information, explore potential carbon-reduction opportunities, compare transition scenarios, and prepare transition-finance reports. Before using the Platform, please read these Terms. Where affirmative acceptance is required, you must accept the Terms before using the relevant feature. If you do not agree, do not use the Platform.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">2. Purpose and Scope of the Platform</h4>
                    <p>The Platform provides decision-support information to analyse financial data, estimate greenhouse-gas emissions using available data, compare potential decarbonisation scenarios, and prepare reports that may be shared with prospective lenders, subject to the SME's explicit approval. The Platform is NOT a substitute for professional financial, legal, accounting, environmental, tax or investment advice.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">3. User Eligibility and Responsibilities</h4>
                    <p>You confirm that you are authorised to use the Platform for yourself or the SME you represent, have the rights and permissions to upload submitted information, that information provided is accurate and complete, and that you will not submit confidential third-party data you are not authorized to disclose.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">4. Information Processing</h4>
                    <p>To provide the Platform, TransitionAI processes business and financial records (bank statements, utility consumption, fuel usage, equipment specs). Information should only be collected that is reasonably necessary for disclosed purposes and permitted by applicable law.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">5. External Artificial Intelligence Services</h4>
                    <p>The Platform uses external AI services to assist with analysing information and generating explanations. Deterministic numerical calculations remain independent of AI text generation. Do not upload information you are not authorised to disclose.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">6. AI Limitations and Human Review</h4>
                    <p>The Platform generates AI-assisted analysis based on available information and assumptions. Outputs are not guaranteed to be error-free. Users must review important outputs and seek professional independent advice.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">7. Carbon Estimates and Environmental Information</h4>
                    <p>Emissions estimates depend on user-provided activity records and documented emissions factors. Figures may be estimates rather than direct measurements. Projected reductions do not prove that reductions have occurred, nor certify an SME as carbon-neutral or guaranteed green financing eligible.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">8. Financial Projections and Financing Disclaimer</h4>
                    <p>The Platform provides illustrative calculations. The Platform does not make binding loan offers, guarantee financing, approve credit applications, or promise a particular financial outcome. A lender remains solely responsible for its own credit assessment and lending decision.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">9. Reviewing and Sharing Reports</h4>
                    <p>A report is NOT automatically authorised for disclosure to a lender. Before an external report is shared, the SME or an authorized representative must review the report and explicitly approve the intended disclosure.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">10. Security and Retention</h4>
                    <p>The Platform maintains safeguards appropriate to the information processed. No online system can be guaranteed completely secure. Information is retained only as disclosed in the Privacy Notice.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">11-18. General Terms, Disclaimers & Law</h4>
                    <p>Includes intellectual property rights, disclaimer of warranties, limitation of liability, suspension and termination, and Malaysian jurisdiction alignment (Contracts Act 1950 & Electronic Commerce Act 2006).</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">19. Contact Information</h4>
                    <p>Platform operator: EcoNexus • Email: econexus@gmail.com • Privacy contact: +60 36789 7676</p>
                  </section>
                </>
              ) : (
                <>
                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">1. Introduction & Operator</h4>
                    <p>TransitionAI is an AI-powered Green Finance Copilot operated by EcoNexus (econexus@gmail.com, +60 36789 7676). We handle personal data in accordance with Malaysia's Personal Data Protection Act 2010 (with 2024 amendments) and international baselines.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">2. Information We May Collect</h4>
                    <p>A. Account & contact details. B. Financial data (bank transactions, revenue, debt). C. Operational & environmental data (electricity bills, fuel receipts, equipment specs). D. Technical usage logs.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">3. How We Use Information</h4>
                    <p>To provide financial summaries, calculate carbon baselines, model transition savings, and prepare reviewable reports for SMEs. General acceptance is NOT permission to disclose reports to lenders.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">4. Use of Artificial Intelligence</h4>
                    <p>AI is used for interpretation and report drafting. Mathematical calculations run through deterministic code. Unnecessary personal identifiers are excluded where practicable.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">5. Disclosure to Lenders</h4>
                    <p>Reports are strictly NOT shared externally merely because they are generated. SMEs must review and approve each disclosure specifically with recorded recipient and timestamp.</p>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">8. Proposed Retention Policy</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Account Information:</strong> Retained while active + up to 12 months after closure.</li>
                      <li><strong>Uploaded Financial Documents:</strong> Retained up to 90 days after analysis.</li>
                      <li><strong>Generated Reports:</strong> Retained up to 12 months after generation.</li>
                      <li><strong>AI Prompts & Outputs:</strong> Retained only as necessary to provide service.</li>
                      <li><strong>Security & Audit Logs:</strong> Retained up to 12 months.</li>
                      <li><strong>Backups:</strong> Maximum 90-day deletion cycle from active storage.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">9. User Rights & Requests</h4>
                    <p>Users may request access, correction, or deletion of their personal and business records by contacting econexus@gmail.com.</p>
                  </section>
                </>
              )}

              {/* End of Document Confirmation Marker */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center flex flex-col items-center justify-center gap-1.5 pb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition ${canAcceptDoc ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {canAcceptDoc
                    ? `You have reached the end of ${activeDoc === 'terms' ? 'Terms & Conditions' : 'Privacy Notice'}`
                    : 'Scroll down completely to reach the end'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {canAcceptDoc
                    ? 'Click "Accept & Close" below to confirm.'
                    : 'Please scroll through all provisions before accepting.'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
              <div className="flex items-center gap-2">
                {!canAcceptDoc ? (
                  <span className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full font-medium">
                    <ArrowDown className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                    <span>Scroll to the end</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Document completed</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={!canAcceptDoc}
                onClick={() => {
                  if (!canAcceptDoc) return;
                  if (activeDoc === 'terms') setAgreedTerms(true);
                  if (activeDoc === 'privacy') setAcknowledgedPrivacy(true);
                  setActiveDoc('none');
                }}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  canAcceptDoc
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                    : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-80'
                }`}
                title={canAcceptDoc ? 'Accept & Close' : 'Please scroll to the bottom of the document first'}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Accept & Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
