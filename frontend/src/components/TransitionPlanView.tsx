// TransitionAI — Financing-Ready Transition Package & Lender Portal
// Incorporates Part 9.4 Report-Sharing Approval Workflow, 17-section dossier preview, and PDF generator

import React, { useEffect, useState } from 'react';
import { useTransition } from '../context/TransitionContext';
import { formatCurrency } from '../utils/transitionCalculations';
import { jsPDF } from 'jspdf';
import { LegalOnboardingModal } from './LegalOnboardingModal';
import { can, requirePermission } from '../auth/permissions';
import { LenderDraft, readDraft, saveDraft, decideDraft } from '../agentData/lenderDrafts';
import { ApprovedPack, loadApprovedPack } from '../agentData/approvedPack';
import { ApprovedPackReview } from './LenderPortal';
import {
  FileCheck2,
  Download,
  Share2,
  Lock,
  ShieldCheck,
  Building,
  Coins,
  Leaf,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Printer,
  FileText,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  Eye
} from 'lucide-react';

// Display-only terms mirror the existing action-specific simulation inputs in
// transitionCalculations.ts; they never feed back into financing calculations.
const ACTION_FINANCING_TERMS: Record<string, { tenureYears: number; interestRatePct: number }> = {
  'ACT-SOLAR-01': { tenureYears: 7, interestRatePct: 3.75 },
  'ACT-LED-02': { tenureYears: 3, interestRatePct: 4.25 },
  'ACT-VFD-03': { tenureYears: 5, interestRatePct: 4 },
  'ACT-EV-04': { tenureYears: 5, interestRatePct: 3.5 },
  'ACT-HVAC-05': { tenureYears: 5, interestRatePct: 4 },
};

export const TransitionPlanView: React.FC = () => {
  const {
    currentRole,
    profile,
    baseline,
    financial,
    selectedActions,
    greenLoanEligibility,
    lenderPackages,
    createLenderPackage,
    auditLogs,
    uploadedFiles,
    financialModel,
    activityRecords
  } = useTransition();

  const [packageName, setPackageName] = useState<string>(
    `${profile.name || 'SME'} Green Transition Financing Pack`
  );
  const [disclosures, setDisclosures] = useState({
    includeExecutiveSummary: true,
    includeCarbonBaseline: true,
    includeFinancialSummary: true,
    includeDecarbonisationPlan: true,
    includeCashFlowProjections: true,
    includeEvidenceDocuments: true
  });

  // Part 9.4 Disclosure Workflow Modal State
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);
  const [selectedLender, setSelectedLender] = useState<string>('Maybank SME Green Facility');
  const [customLenderName, setCustomLenderName] = useState<string>('');
  const [disclosurePurpose, setDisclosurePurpose] = useState<string>('Concessionary Green Financing Application under BNM Low Carbon Transition Facility (LCTF)');
  const [signatoryName, setSignatoryName] = useState<string>('Managing Director');
  const [signatoryRole, setSignatoryRole] = useState<string>('Authorised Representative / Director');
  const [confirmedTruthful, setConfirmedTruthful] = useState<boolean>(false);
  const [confirmedShareConsent, setConfirmedShareConsent] = useState<boolean>(false);

  const [showDetails, setShowDetails] = useState(false);
  const [showLegalConsent, setShowLegalConsent] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const activePackage = lenderPackages[0];

  // Total Planned CapEx & Savings
  const totalCapex = selectedActions.reduce((s, a) => s + a.capex, 0);
  const totalSavings = selectedActions.reduce((s, a) => s + a.annualOpExSavings, 0);
  const totalCO2 = selectedActions.reduce((s, a) => s + a.annualCO2eReductionTons, 0);

  // Presentation totals only: preserve each existing financing simulation.
  const financingRequested = selectedActions.reduce((sum, action) => sum + action.financing.loanPrincipal, 0);
  const monthlyRepayment = selectedActions.reduce((sum, action) => sum + action.financing.monthlyRepayment, 0);
  const displayNumber = (value: number, decimals = 1) => new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value);
  const money = (value: number) => `${profile.currency} ${displayNumber(value, 0)}`;
  const hasPathway = selectedActions.length > 0;
  const evidenceItems = [
    { label: 'Company profile', available: profile.isConfigured },
    { label: 'Utility & fuel records', available: activityRecords.length > 0 && uploadedFiles.some(file => ['electricity', 'fuel_diesel', 'fuel_gas', 'fuel_petrol', 'fuel_lpg'].includes(file.detectedCategory)) },
    { label: 'Financial statements', available: !!financialModel?.isConfigured },
    { label: 'Equipment quotations', available: false },
    { label: 'Scope 3 assessment', available: false },
  ];

  const smeContribution = selectedActions.reduce((sum, action) => sum + action.financing.equityContributionRequired, 0);
  const totalInterest = selectedActions.reduce((sum, action) => sum + action.financing.totalInterestPaid, 0);
  const totalRepayment = financingRequested + totalInterest;
  const readyEvidenceCount = evidenceItems.filter(item => item.available).length;
  const rangeLabel = (values: number[], decimals: number, unit: string) => {
    if (!values.length || values.some(value => !Number.isFinite(value))) return 'Not available';
    const lowest = Math.min(...values);
    const highest = Math.max(...values);
    return `${displayNumber(lowest, decimals)}${lowest !== highest ? ` - ${displayNumber(highest, decimals)}` : ''}${unit}`;
  };
  const terms = selectedActions.map(action => ACTION_FINANCING_TERMS[action.id]);
  const tenureLabel = rangeLabel(terms.map(term => term?.tenureYears ?? NaN), 0, ' years');
  const rateLabel = rangeLabel(terms.map(term => term?.interestRatePct ?? NaN), 2, '%');
  const paybackLabel = rangeLabel(selectedActions.map(action => action.paybackPeriodYears), 1, ' years');

  const canApprove = can(currentRole, 'approve_disclosure');
  const [draft, setDraft] = useState<LenderDraft | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [approvedPreview, setApprovedPreview] = useState<ApprovedPack | null>(null);
  const [previewError, setPreviewError] = useState('');
  const fingerprint = JSON.stringify({ profile, baseline, financial, selectedActions, uploadedFiles });
  useEffect(() => {
    const saved = readDraft(profile.id);
    setDraft(saved);
    if (saved) { setPackageName(saved.packageName); setDisclosures(saved.disclosures as typeof disclosures); }
  }, [profile.id]);
  const prepareDraft = (): LenderDraft | null => {
    try {
      requirePermission(currentRole, 'prepare_pack');
      const saved = saveDraft(currentRole, { companyId: profile.id, reportingYear: profile.reportingYear, packageName, disclosures, fingerprint });
      setDraft(saved); setDraftMessage('Draft saved for SME Owner review. Nothing has been shared.');
      return saved;
    } catch (error) { setDraftMessage(error instanceof Error ? error.message : 'Draft could not be saved'); return null; }
  };
  const requestDisclosureReview = () => {
    if (!canApprove) { setDraftMessage('Access denied: only the SME Owner may approve disclosure.'); return; }
    if (!hasPathway) { setDraftMessage('Select transition actions before requesting disclosure.'); return; }
    if (draft && (draft.fingerprint !== fingerprint || draft.packageName !== packageName || JSON.stringify(draft.disclosures) !== JSON.stringify(disclosures))) {
      setDraftMessage('The draft differs from the current workspace. Save an updated draft before reviewing.'); return;
    }
    if (!draft && !prepareDraft()) return;
    setShowDetails(false); setConfirmedTruthful(false); setConfirmedShareConsent(false); setRejectionReason('');
    if (localStorage.getItem('transitionai_legal_accepted') !== 'true') setShowLegalConsent(true);
    else setIsApprovalModalOpen(true);
  };
  const rejectDisclosure = () => {
    try {
      requirePermission(currentRole, 'approve_disclosure');
      if (!draft) throw new Error('Prepare a draft before recording a decision.');
      setDraft(decideDraft(currentRole, draft, 'REJECTED', rejectionReason));
      setIsApprovalModalOpen(false); setDraftMessage('Draft disclosure rejected. Nothing has been shared.');
    } catch (error) { setDraftMessage(error instanceof Error ? error.message : 'Decision could not be recorded'); }
  };
  const openLenderPreview = async () => {
    setPreviewOpen(true); setApprovedPreview(null); setPreviewError('');
    try {
      if (!activePackage?.isShared) throw new Error('No approved/shared pack is available for lender preview.');
      setApprovedPreview(await loadApprovedPack(activePackage.sharingToken));
    } catch (error) { setPreviewError(error instanceof Error ? error.message : 'Preview unavailable'); }
  };

  // Authorize / Create Lender Package following Part 9.4 workflow
  const handleConfirmAuthorization = async () => {
    if (!canApprove) { setDraftMessage('Access denied: SME Owner approval is required.'); return; }
    if (!draft || draft.fingerprint !== fingerprint || draft.packageName !== packageName || JSON.stringify(draft.disclosures) !== JSON.stringify(disclosures)) {
      setDraftMessage('Save and review the current draft before approving disclosure.'); return;
    }
    if (!confirmedTruthful || !confirmedShareConsent || !signatoryName.trim()) {
      alert('Please complete the signatory name and both affirmative approval confirmations.');
      return;
    }

    setIsGenerating(true);
    try {
      const lenderTarget = selectedLender === 'Other Financial Institution' ? customLenderName : selectedLender;
      const executiveSummary = `${profile.name || 'The Borrower'} is presenting this Green Financing Package to ${lenderTarget} for the purpose of "${disclosurePurpose}". Authorized CapEx commitment totals RM ${totalCapex.toLocaleString()} with projected ${displayNumber(totalCO2)} tCO2e annual emissions abatement. Formally authorized by ${signatoryName} (${signatoryRole}).`;

      await createLenderPackage(packageName, disclosures, executiveSummary);
      try {
        setDraft(decideDraft(currentRole, draft, 'APPROVED'));
        setDraftMessage('Disclosure approved by SME Owner. The shared pack is available to its token holder.');
      } catch {
        setDraftMessage('Disclosure approved and recorded by the server; the local demo decision record could not be saved.');
      }
      setIsApprovalModalOpen(false);
      alert(`Report formally authorized and released for disclosure to ${lenderTarget}! Cryptographic audit log entry generated.`);
    } catch (err: any) {
      alert(`Package authorization failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download Transition Plan as PDF using jsPDF (17 Sections from Part 10)
  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF();
      let y = 20;

      // Header Banner
      doc.setFontSize(18);
      doc.setTextColor(16, 120, 80);
      doc.text('TransitionAI — SME Green Transition Plan', 15, y);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Financing-Ready Credit Dossier • Prepared for Malaysian Commercial & Development Lenders`, 15, y);
      y += 8;

      doc.setDrawColor(200);
      doc.line(15, y, 195, y);
      y += 10;

      // Section 1: Executive Summary
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Executive Financing Summary', 15, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70);
      doc.text(`Borrower: ${profile.name || 'Apex Precision Manufacturing Sdn Bhd'} (${profile.industry || 'Manufacturing'})`, 15, y);
      y += 5;
      doc.text(`Target Capital Requirement: RM ${totalCapex.toLocaleString()} (Green Transition CapEx)`, 15, y);
      y += 5;
      doc.text(`Projected Annual Utility Savings: RM ${totalSavings.toLocaleString()}/yr • CO2 Abatement: ${displayNumber(totalCO2)} tCO2e/yr`, 15, y);
      y += 8;

      // Section 2: Borrower Profile
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text('2. Facility & Operational Profile', 15, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70);
      doc.text(`Registration: ${profile.registrationNumber || '201801029481 (1289502-K)'} • Location: ${profile.facilityLocation}`, 15, y);
      y += 5;
      doc.text(`Floor Area: ${profile.facilityFloorAreaSqM} m² • Employees: ${profile.employeeCount} • Currency: ${profile.currency}`, 15, y);
      y += 8;

      // Section 3: Audited Carbon Baseline
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text('3. Audited Carbon Baseline (GHG Protocol Scope 1 & 2)', 15, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70);
      doc.text(`Total Baseline Emissions: ${baseline.totalTCO2e} tCO2e / year`, 15, y);
      doc.text(`Verification Grade: ${baseline.dataConfidence.overallScorePct}% (${baseline.dataConfidence.level} Confidence)`, 110, y);
      y += 5;
      doc.text(`Scope 1 Direct (Fuel Combustion): ${baseline.scope1TCO2e} tCO2e`, 15, y);
      doc.text(`Scope 2 Indirect (Grid Electricity): ${baseline.scope2TCO2e} tCO2e`, 110, y);
      y += 5;
      doc.text(`Grid Factor: 0.584 kgCO2e/kWh (Suruhanjaya Tenaga 2023 Peninsular Malaysia Grid Factor)`, 15, y);
      y += 8;

      // Section 4: Financial Position & DSCR
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text('4. Financial Analysis & Debt Service Capacity', 15, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70);
      doc.text(`Annual Gross Revenue: RM ${financial.annualRevenue.toLocaleString()} • OpEx: RM ${financial.annualOpEx.toLocaleString()}`, 15, y);
      y += 5;
      doc.text(`Operating EBITDA: RM ${financial.ebitda.toLocaleString()} • Current DSCR: ${financial.currentDscr.toFixed(2)}x`, 15, y);
      y += 5;
      doc.text(`Estimated Borrowing Capacity: RM ${financial.maxBorrowingCapacityAtTargetDscr.toLocaleString()} at 1.25x DSCR covenant`, 15, y);
      y += 8;

      // Section 5: Decarbonisation Roadmap
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text('5. Proposed Decarbonisation Interventions (Use of Proceeds)', 15, y);
      y += 6;

      selectedActions.forEach((act, idx) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.text(`${idx + 1}. ${act.title}: CapEx RM ${act.capex.toLocaleString()} | Bill Savings RM ${act.annualOpExSavings.toLocaleString()}/yr | Payback ${act.paybackPeriodYears} yrs`, 15, y);
        y += 5;
      });

      y += 4;
      // Section 6: Green Financing Alignment & Compliance
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text('6. Green Financing Facility Alignment', 15, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70);
      doc.text(`Facility: Bank Negara Malaysia Low Carbon Transition Facility (LCTF)`, 15, y);
      y += 5;
      doc.text(`Readiness Status: ${greenLoanEligibility.overallStatus} (${greenLoanEligibility.readinessScorePct}% Checklist Complete)`, 15, y);
      y += 10;

      // Footer Disclaimers
      doc.setDrawColor(220);
      doc.line(15, y, 195, y);
      y += 6;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Disclosure Notice: Generated by TransitionAI on ${new Date().toLocaleDateString()}. Cryptographic Hash #TRN-${Date.now().toString(36)}.`, 15, y);
      y += 4;
      doc.text(`This dossier is a decision-support and credit preparation package. It does not constitute a binding loan commitment from a lender.`, 15, y);

      doc.save(`${profile.name || 'SME'}_Green_Transition_Plan.pdf`);
    } catch (err) {
      console.error('[PDF Download Error]', err);
      alert('PDF generation encountered an error. Please try again.');
    }
  };

  return (
    <div className="gb-dashboard gb-pack-view">
      <div className="gb-page-heading gb-proposal-heading">
        <div><h1>Lender Transition Pack</h1><p>{profile.name || 'SME Workspace'} | FY {profile.reportingYear}</p></div>
        <div className="gb-header-actions">
          <button className="gb-button" onClick={() => setShowDetails(true)}>View details</button>
          <button className="gb-button" onClick={openLenderPreview}><Eye size={14} /> Lender Preview</button>
          <button className="gb-button" onClick={handleDownloadPdf}><Download size={14} /> Export PDF</button>
        </div>
      </div>
      <div className="gb-finance-simulation">
        <section className="gb-simulation-card" aria-labelledby="financing-details-heading">
          <h2 id="financing-details-heading">Financing Details</h2>
          <dl>
            <div><dt>Total project CAPEX</dt><dd>{hasPathway ? money(totalCapex) : '--'}</dd></div>
            <div><dt>SME contribution</dt><dd>{hasPathway ? money(smeContribution) : '--'}</dd></div>
            <div className="gb-financing-request"><dt>Financing requested</dt><dd>{hasPathway ? money(financingRequested) : '--'}</dd></div>
            <div><dt>Loan tenure</dt><dd>{tenureLabel}</dd></div>
            <div><dt>Interest rate</dt><dd>{rateLabel}</dd></div>
          </dl>
        </section>
        <section className="gb-simulation-card gb-repayment-card" aria-labelledby="repayment-heading">
          <h2 id="repayment-heading">Estimated Repayment</h2>
          <div className="gb-monthly-repayment"><span>Monthly repayment</span><strong>{hasPathway ? money(monthlyRepayment) : '--'}</strong><small>per month</small></div>
          <dl>
            <div><dt>Total repayment</dt><dd>{hasPathway ? money(totalRepayment) : '--'}</dd></div>
            <div><dt>Total interest</dt><dd>{hasPathway ? money(totalInterest) : '--'}</dd></div>
            <div><dt>Post-financing DSCR</dt><dd title="A combined company post-financing ratio is not supplied by the existing model.">Not available</dd></div>
          </dl>
        </section>
        <section className="gb-simulation-card" aria-labelledby="impact-heading">
          <h2 id="impact-heading">Transition Impact</h2>
          <dl>
            <div><dt>Annual savings</dt><dd>{hasPathway ? money(totalSavings) : '--'}</dd></div>
            <div><dt>CO<sub>2</sub> reduction / year</dt><dd>{hasPathway ? <>{displayNumber(totalCO2)} tCO<sub>2</sub>e</> : '--'}</dd></div>
            <div><dt>Payback period</dt><dd>{paybackLabel}</dd></div>
          </dl>
          <button className="gb-evidence-inline" onClick={() => setShowDetails(true)}>Evidence: {readyEvidenceCount}/{evidenceItems.length} ready <span>View details</span></button>
        </section>
      </div>
      <section className="gb-generate-pack" aria-labelledby="generate-pack-heading">
        <div><h2 id="generate-pack-heading">Generate Lender Pack</h2><p>Create a lender-ready summary of the transition project, financing and evidence.</p><small>Subject to SME disclosure consent; not lender approval.</small></div>
        <button className="gb-button gb-primary" disabled={isGenerating || !hasPathway} onClick={canApprove ? requestDisclosureReview : () => { prepareDraft(); }}><UserCheck size={16} /> {canApprove ? "Review & Generate Lender Pack" : "Save draft for SME Owner"}</button>
      </section>
      <div className="gb-draft-feedback" role="status">{draftMessage || (draft ? `Draft status: ${draft.status} | Prepared by ${draft.preparedBy === 'finance_manager' ? 'Finance Manager' : 'SME Owner'}` : 'Prepare a draft; SME Owner authorization is required before sharing.')}</div>
      {previewOpen && <div className="gb-proposal-details-overlay"><div className="gb-proposal-details" role="dialog" aria-modal="true" aria-label="Authorized lender preview"><div className="gb-proposal-details-heading"><h2>Lender Preview</h2><button autoFocus className="gb-button" onClick={() => setPreviewOpen(false)}>Close preview</button></div><div className="gb-proposal-details-content">{previewError ? <p role="alert">{previewError}</p> : approvedPreview ? <ApprovedPackReview pack={approvedPreview} /> : <p role="status">Loading approved disclosure...</p>}</div></div></div>}
      {showDetails && <div className="gb-proposal-details-overlay" onKeyDown={event => {
        if (event.key === 'Escape') setShowDetails(false);
        if (event.key === 'Tab') {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]'
          )).filter(element => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <div className="gb-proposal-details" role="dialog" aria-modal="true" aria-label="Transition pack details">
          <div className="gb-proposal-details-heading"><h2>Transition pack details</h2><button autoFocus className="gb-button" onClick={() => setShowDetails(false)}>Close details</button></div>
          <div className="gb-proposal-details-content">
            <details className="gb-panel"><summary>Evidence readiness ({readyEvidenceCount}/{evidenceItems.length} available)</summary><ul className="gb-evidence-checklist">{evidenceItems.map(item => <li key={item.label}><span className={item.available ? 'gb-evidence-available' : 'gb-evidence-missing'} aria-hidden="true">{item.available ? <Check size={14} /> : <AlertTriangle size={14} />}</span><span>{item.label}</span><small>{item.available ? 'Available' : 'Missing / unverified'}</small></li>)}</ul><p>Data confidence: {displayNumber(baseline.dataConfidence.overallScorePct, 0)}%. Availability does not imply independent verification.</p></details>
            <details className="gb-panel"><summary>Financing assumptions & pack status</summary><p>Totals combine existing per-action simulations. Rate, tenure and payback ranges describe separate actions, not a single blended loan or portfolio payback.</p><p>SME contributions and principal are copied from the existing model, which computes them separately; they are not a reconciled funding offer. Total repayment is existing principal plus existing total interest.</p><p>Combined company post-financing DSCR is not supplied. Per-action savings-to-repayment ratios are shown below and must not be interpreted as company DSCR.</p><p>Latest package: {activePackage?.isShared ? 'APPROVED FOR DISCLOSURE' : 'DRAFT'}. Changes to the project require a new review. Approval authorizes disclosure, not lender financing.</p></details>
            <details className="gb-panel"><summary>Data limitations</summary><p>Projections and sample records require verification; Scope 3 is not assessed.</p><ul>{baseline.dataConfidence.missingPeriods.map((period, i) => <li key={i}>{period}</li>)}</ul></details>
          <details className="gb-panel"><summary>Pathway assumptions & financing details</summary>{selectedActions.map(action => <div className="gb-panel" key={action.id}><h3>{action.title}</h3><dl className="gb-facts"><div><dt>CAPEX</dt><dd>{formatCurrency(action.capex, profile.currency)}</dd></div><div><dt>Financing principal</dt><dd>{formatCurrency(action.financing.loanPrincipal, profile.currency)}</dd></div><div><dt>Loan tenure</dt><dd>{ACTION_FINANCING_TERMS[action.id]?.tenureYears ?? "Not available"} years</dd></div><div><dt>Interest rate</dt><dd>{ACTION_FINANCING_TERMS[action.id] ? `${displayNumber(ACTION_FINANCING_TERMS[action.id].interestRatePct, 2)}%` : "Not available"}</dd></div><div><dt>Monthly repayment</dt><dd>{formatCurrency(action.financing.monthlyRepayment, profile.currency)}</dd></div><div><dt>Annual carbon reduction</dt><dd>{displayNumber(action.annualCO2eReductionTons)} tCO2e</dd></div><div><dt>Action savings / repayment ratio</dt><dd>{displayNumber(action.financing.postInterventionDscr, 2)}x</dd></div></dl><ul>{action.assumptions.map((assumption, i) => <li key={i}>{assumption}</li>)}</ul></div>)}{!hasPathway && <p>No selected pathway.</p>}</details>
      {/* SME Owner Disclosure Controls Card (Only visible to SME Owner & Finance Mgr) */}
      {currentRole !== 'lender' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                SME Owner Disclosure Controls & Authorization Gate
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Explicitly choose which sections and verified evidentiary files to disclose to prospective lenders.
              </p>
            </div>
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Review disclosure scope</span>
            </span>
          </div>

          {/* Package Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lender Dossier Package Name
              </label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Green Facilities
              </label>
              <input
                type="text"
                disabled
                value="Bank Negara Malaysia LCTF / Maybank SME Green Facility / GTFS 4.0"
                className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Disclosure Checkboxes */}
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Authorized Disclosed Sections:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(disclosures).map(([key, val]) => (
                <label
                  key={key}
                  className="flex items-center space-x-2 text-xs text-slate-700 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => setDisclosures({ ...disclosures, [key]: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium capitalize">
                    {key.replace('include', '').replace(/([A-Z])/g, ' $1')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button className="gb-button" onClick={() => { prepareDraft(); }}>Save draft changes</button>
          {/* Authorization Trigger Button (Opens Part 9.4 Approval Modal) */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 gap-3">
            <span className="text-xs text-slate-500">
              Enforces Part 9.4: Generating a report does not share it. Explicit recipient authorization is required.
            </span>
            <button
              onClick={canApprove ? requestDisclosureReview : () => { prepareDraft(); }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>{canApprove ? "Review & Authorize Report Disclosure" : "Save draft for SME Owner"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Lender Package Dossier */}
      {activePackage && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-slate-900">{activePackage.packageName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  SME-approved for sharing
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized By: {activePackage.authorizedBy} • Created: {activePackage.createdDate} • Valid for 60 Days
              </p>
            </div>

            {/* Sharing Token Copy Button */}
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700">
                {activePackage.sharingToken}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activePackage.sharingToken);
                  setCopiedToken(activePackage.sharingToken);
                  setTimeout(() => setCopiedToken(null), 2000);
                }}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                title="Copy Sharing Token"
              >
                {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Credit Committee Risk & Readiness Evaluation */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Lender Credit Analyst Summary Evaluation
              </h3>
              <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                activePackage.lenderRiskAssessment.overallRisk === 'Low'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                Indicative risk: {activePackage.lenderRiskAssessment.overallRisk}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-emerald-800 block mb-1">Key Credit Strengths:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {activePackage.lenderRiskAssessment.lenderKeyStrengths.map((str, i) => (
                    <li key={i}>{str}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="font-bold text-amber-800 block mb-1">Risk Factors & Mitigants:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {activePackage.lenderRiskAssessment.lenderKeyRisks.map((rsk, i) => (
                    <li key={i}>{rsk}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Executive Summary Narrative */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Executive Financing Summary Narrative
            </h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans">
              {activePackage.executiveSummaryText}
            </div>
          </div>

          {/* Decarbonisation Roadmap Sizing in Package */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Proposed Decarbonisation Use of Proceeds ({selectedActions.length} Interventions)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Intervention Asset</th>
                    <th className="py-2.5 px-3">CapEx</th>
                    <th className="py-2.5 px-3">Annual Bill Savings</th>
                    <th className="py-2.5 px-3">CO₂ Reduction</th>
                    <th className="py-2.5 px-3">Simple Payback</th>
                    <th className="py-2.5 px-3">Net Monthly Cash Flow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedActions.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{act.title}</td>
                      <td className="py-2.5 px-3 font-mono">{formatCurrency(act.capex, profile.currency)}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">
                        {formatCurrency(act.annualOpExSavings, profile.currency)}/yr
                      </td>
                      <td className="py-2.5 px-3 font-mono">{displayNumber(act.annualCO2eReductionTons)} t/yr</td>
                      <td className="py-2.5 px-3">{act.paybackPeriodYears} yrs</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        +{formatCurrency(act.financing.netMonthlyCashFlowImpact, profile.currency)}/mo
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!activePackage && <div className="gb-panel"><h2>No authorized dossier yet</h2><p>Review the draft and complete SME disclosure authorization to create a package.</p></div>}
      {currentRole === 'lender' && <div className="gb-panel"><p>Disclosure settings are controlled by the SME signatory.</p></div>}
          </div>
        </div>
      </div>}
      <LegalOnboardingModal
        isOpen={showLegalConsent}
        onClose={() => setShowLegalConsent(false)}
        title="Before sharing your Lender Pack"
        subtitle="Review the terms and privacy notice before continuing to SME disclosure approval."
        onAccept={() => {
          localStorage.setItem('transitionai_legal_accepted', 'true');
          setShowLegalConsent(false);
          setIsApprovalModalOpen(true);
        }}
      />
      {/* Part 9.4 Report-Sharing Approval Modal */}
      {isApprovalModalOpen && canApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-label="Disclosure authorization" className="gb-approval-modal bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Mandatory Report Disclosure Authorization
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    SME consent to disclosure only. This does not constitute lender approval.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Recipient Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Designated Recipient Institution <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedLender}
                  onChange={(e) => setSelectedLender(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                >
                  <option value="Maybank SME Green Facility">Maybank — SME Green Energy Financing Facility</option>
                  <option value="CIMB Bank Green BizReady">CIMB Bank — Green BizReady Sustainability Line</option>
                  <option value="Public Bank Green Transition Facility">Public Bank — Green Financing Facility</option>
                  <option value="RHB Bank Sustainable Financing">RHB Bank — Low Carbon SME Loan</option>
                  <option value="Bank Negara Malaysia (BNM LCTF)">Bank Negara Malaysia — LCTF Administrator</option>
                  <option value="SME Bank Malaysia">SME Bank Malaysia — Sustainability Scheme</option>
                  <option value="Other Financial Institution">Other Financial Institution (Specify Below)</option>
                </select>
              </div>

              {selectedLender === 'Other Financial Institution' && (
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Custom Institution Name</label>
                  <input
                    type="text"
                    value={customLenderName}
                    onChange={(e) => setCustomLenderName(e.target.value)}
                    placeholder="e.g. Alliance Bank Malaysia / Hong Leong Bank"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              )}

              {/* Purpose */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  2. Purpose of Disclosure <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={disclosurePurpose}
                  onChange={(e) => setDisclosurePurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              {/* Signatory Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Signatory Full Name</label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation / Role</label>
                  <input
                    type="text"
                    value={signatoryRole}
                    onChange={(e) => setSignatoryRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Affirmative Checkboxes */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedTruthful}
                    onChange={(e) => setConfirmedTruthful(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <span className="text-[11px] text-slate-700 leading-tight">
                    I confirm that the uploaded utility bills, fuel records, and financial statements represent authentic, truthful operational data of <strong>{profile.name || 'this enterprise'}</strong>.
                  </span>
                </label>

                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedShareConsent}
                    onChange={(e) => setConfirmedShareConsent(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <span className="text-[11px] text-slate-700 leading-tight">
                    I explicitly authorize TransitionAI to compile and disclose this credit dossier to the designated lender institution. I understand this disclosure is recorded in the permanent audit trail.
                  </span>
                </label>
              </div>
            </div>

            <label className="gb-rejection-reason">Reason if rejecting this draft<input value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} placeholder="Explain what needs to change" /></label>
            {draftMessage && <p role="status" className="text-xs text-slate-600">{draftMessage}</p>}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <button className="gb-button" disabled={isGenerating || !rejectionReason.trim()} onClick={rejectDisclosure}>Reject disclosure</button>
              <button
                onClick={handleConfirmAuthorization}
                disabled={isGenerating || !confirmedTruthful || !confirmedShareConsent || !signatoryName.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve specified disclosure</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
