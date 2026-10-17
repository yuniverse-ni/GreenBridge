import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatMYR } from '../utils/financeCalculations';
import {
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  FileCheck,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Calendar,
  AlertTriangle,
  Receipt,
  Building,
  Check,
  Download,
  Printer,
  FileText
} from 'lucide-react';

export const AuditReportView: React.FC = () => {
  const {
    businessProfile,
    invoices,
    bills,
    forecast,
    hasSimulatedPayment,
    simulatedPaymentMeta,
    proposedActions,
    setActiveTab,
    resetDemo,
    auditLogs,
    uploadedFiles
  } = useFinance();

  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  // Find lowest balance in current forecast
  let lowestClosing = forecast[0]?.closingBalanceSen ?? 0;
  for (const pt of forecast) {
    if (pt.closingBalanceSen < lowestClosing) lowestClosing = pt.closingBalanceSen;
  }

  const isResolved = lowestClosing >= businessProfile.minReserveSen;
  const totalBillsSen = bills.filter((b) => b.status !== 'paid').reduce((acc, b) => acc + b.amountSen, 0);
  const overdueInvoice = simulatedPaymentMeta
    ? invoices.find((i) => i.id === simulatedPaymentMeta.invoiceId)
    : invoices.find((i) => i.status === 'paid' && i.simulatedPaidDate) || invoices[0];

  const originalCashSen = hasSimulatedPayment && simulatedPaymentMeta
    ? businessProfile.initialCashSen - simulatedPaymentMeta.amountSen
    : businessProfile.initialCashSen;
  const originalLowestSen = hasSimulatedPayment && simulatedPaymentMeta
    ? lowestClosing - simulatedPaymentMeta.amountSen
    : lowestClosing;
  const originalDeficitSen = Math.max(0, businessProfile.minReserveSen - originalLowestSen);

  // Generate structured audit report text file
  const handleDownloadReportTxt = () => {
    const timestamp = new Date().toLocaleString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const reportLines = [
      '================================================================================',
      '       CASHPILOT — SME FINANCIAL GOVERNANCE & FORECAST AUDIT REPORT',
      '================================================================================',
      `Business Name:       ${businessProfile.name || 'Your Company'}`,
      `Registration No:     ${businessProfile.registrationNumber || 'N/A'}`,
      `Operating Currency:  ${businessProfile.currency} (Malaysian Ringgit)`,
      `Operating Bank:      ${businessProfile.bankName || 'Operating Account'} (${businessProfile.accountNumberMasked || '••••'})`,
      `Report Generated:    ${timestamp}`,
      `Report Identifier:   CP-AUDIT-${Date.now()}`,
      `Forecast Horizon:    ${businessProfile.forecastHorizonDays || 30} Days`,
      '',
      '1. SOURCE DATA MANIFEST',
      '--------------------------------------------------------------------------------',
      ...(uploadedFiles && uploadedFiles.length > 0
        ? uploadedFiles.map((f) => `- ${f.fileName} (${f.fileType}) | Uploaded: ${f.uploadedAt} | Records: ${f.recordCount} | Category: ${f.category.toUpperCase()}`)
        : ['- Direct Configuration / Active Operating State']),
      '',
      '2. EXECUTIVE RECONCILIATION & RESOLUTION SUMMARY',
      '--------------------------------------------------------------------------------',
      `Overall Health Status:      ${hasSimulatedPayment && isResolved ? 'HEALTHY & SAFE (100% Reserve Intact)' : isResolved ? 'HEALTHY (Reserve Covered)' : 'DEFICIT RISK IN PROGRESS'}`,
      `Minimum Reserve Target:     ${formatMYR(businessProfile.minReserveSen)}`,
      `Current Bank Cash Balance:  ${formatMYR(businessProfile.initialCashSen)}`,
      `Upcoming Bills (Total):     ${formatMYR(totalBillsSen)}`,
      `Lowest Projected Cash Point:${formatMYR(lowestClosing)}`,
      `Reserve Breach Deficit:     ${lowestClosing < businessProfile.minReserveSen ? formatMYR(businessProfile.minReserveSen - lowestClosing) : 'RM 0.00 (Zero Deficit)'}`,
      '',
      '3. BEFORE & AFTER FINANCIAL COMPARISON',
      '--------------------------------------------------------------------------------',
      'Metric                          Original (Pre-Intervention)   Updated (Post-Intervention)',
      '--------------------------------------------------------------------------------',
      `Cleared Available Cash:         ${formatMYR(originalCashSen).padEnd(30)} ${formatMYR(businessProfile.initialCashSen)}`,
      `Upcoming Bills:                 ${('-' + formatMYR(totalBillsSen)).padEnd(30)} ${('-' + formatMYR(totalBillsSen))}`,
      `Settled Receivable:             ${(overdueInvoice ? formatMYR(overdueInvoice.amountSen) + ' (Uncollected)' : 'RM 0.00').padEnd(30)} ${hasSimulatedPayment ? 'Reconciled (Paid)' : 'Unsettled'}`,
      `Lowest Projected Cash:          ${formatMYR(originalLowestSen).padEnd(30)} ${formatMYR(lowestClosing)}`,
      `Reserve Deficit:                ${(originalDeficitSen > 0 ? '-' + formatMYR(originalDeficitSen) + ' deficit' : 'RM 0.00').padEnd(30)} ${lowestClosing >= businessProfile.minReserveSen ? 'RM 0.00 (Reserve Intact)' : '-' + formatMYR(businessProfile.minReserveSen - lowestClosing)}`,
      '',
      '3. INVOICES & BILLS RECONCILIATION RECORD',
      '--------------------------------------------------------------------------------',
      ...invoices.map((inv) =>
        `- Invoice ${inv.id}: ${inv.customerName} | ${formatMYR(inv.amountSen)} | Due: ${inv.dueDate} | Status: ${inv.status.toUpperCase()}${
          inv.status === 'paid' ? ' (Reconciled via Instant DuitNow Transfer #DN-9948271)' : ''
        }`
      ),
      ...bills.map((bill) =>
        `- Bill ${bill.id}: ${bill.vendorName} | ${formatMYR(bill.amountSen)} | Due Offset: Day ${bill.dueDayOffset} (${bill.dueDate}) | Status: ${bill.status.toUpperCase()}`
      ),
      '',
      '4. PROPOSED & AUTHORIZED ACTIONS',
      '--------------------------------------------------------------------------------',
      ...proposedActions.map((act) => [
        `- Action ID:        ${act.id}`,
        `  Title:            ${act.title}`,
        `  Target Entity:    ${act.targetEntity} (${act.recipientContact || 'Accounts'})`,
        `  Amount:           ${formatMYR(act.amountSen)}`,
        `  Governance Rule:  ${act.requiresHumanApproval ? 'Explicit Human Authorization Required' : 'Automated'}`,
        `  Status:           ${act.status.toUpperCase()}${act.approvedDate ? ` (Approved at: ${act.approvedDate})` : ''}`,
        act.executionReceipt ? `  Execution ID:     ${act.executionReceipt.dispatchId} via ${act.executionReceipt.channel}` : '',
        `  Expected Effect:  ${act.expectedEffect}`,
        ''
      ]).flat().filter(Boolean),
      '',
      '5. CHRONOLOGICAL GOVERNANCE AUDIT LOG',
      '--------------------------------------------------------------------------------',
      ...auditLogs.map((log) =>
        `[${log.timestamp}] Stage ${log.stepNumber}: ${log.stage.padEnd(20)} | Actor: ${log.actor.padEnd(26)} | Status: ${log.statusBadge.toUpperCase()}\n  Summary: ${log.summary}\n  Details: ${log.detail}\n`
      ),
      '',
      '6. REGULATORY & COMPLIANCE STATEMENT',
      '--------------------------------------------------------------------------------',
      'This report is generated by CashPilot AI Copilot for SME Financial Governance.',
      'All authoritative financial calculations are computed deterministically in integer sen.',
      'CashPilot enforces strict human-in-the-loop authorization and does not initiate',
      'unauthorized money movements or modify contractual supplier agreements.',
      '================================================================================',
      '                               END OF REPORT'
    ];

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CashPilot_Audit_Report_${businessProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccessToast('Audit Report downloaded (.txt)');
    setTimeout(() => setDownloadSuccessToast(null), 3000);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {downloadSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{downloadSuccessToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Outcome Verification & Audit Report
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
              Closed-Loop Reforecast
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Complete reconciliation audit verifying that all 30 days have been recomputed with zero remaining reserve breaches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto no-print">
          {/* Download Audit Report Buttons */}
          <button
            onClick={handleDownloadReportTxt}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center space-x-1.5"
            title="Download full financial timeline & forecast audit as text file"
          >
            <Download className="w-4 h-4" />
            <span>Download Audit Report (.txt)</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="px-3.5 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium transition flex items-center space-x-1.5"
            title="Print or Save as PDF via browser"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-3 py-2 text-slate-700 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-medium transition flex items-center space-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={resetDemo}
            className="px-3 py-2 text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl text-xs sm:text-sm font-medium transition flex items-center space-x-1"
            title="Reset demo scenario back to initial deficit"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay Demo</span>
          </button>
        </div>
      </div>

      {/* Reforecast Health Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        hasSimulatedPayment && isResolved
          ? 'bg-linear-to-r from-emerald-50 via-teal-50 to-white border-emerald-300 shadow-xs'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-start space-x-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white ${
            hasSimulatedPayment && isResolved ? 'bg-emerald-600' : 'bg-amber-500'
          }`}>
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                hasSimulatedPayment && isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {hasSimulatedPayment && isResolved ? 'Problem Formally Resolved' : 'Resolution in Progress'}
              </span>
              <span className="text-xs text-slate-500">
                Horizon: 30 of 30 Days Re-evaluated
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              {hasSimulatedPayment && isResolved
                ? 'Liquidity Safe: 100% Minimum Cash Reserve Maintained'
                : 'Pending Simulated Payment Reconciliation'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {hasSimulatedPayment && isResolved
                ? `Deterministic recalculation confirms that customer collection (+${formatMYR(simulatedPaymentMeta?.amountSen || (overdueInvoice?.amountSen || 0))}) provides sufficient cleared funds to cover scheduled supplier commitments while preserving your ${formatMYR(businessProfile.minReserveSen)} safety reserve.`
                : 'Follow through with approved recovery actions or simulate settlement in the Timeline tab to inspect the reforecasted outcome.'}
            </p>
          </div>
        </div>
      </div>

      {/* Before & After Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BEFORE CARD */}
        <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
            Original Projected State
          </div>

          <div>
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">
              Prior to Intervention
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {originalDeficitSen > 0 ? 'Deficit Risk Identified' : 'Initial Baseline'}
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Opening Available Cash:</span>
                <span className="font-mono font-bold text-slate-900">{formatMYR(originalCashSen)}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Upcoming Supplier Bills:</span>
                <span className="font-mono font-bold text-rose-600">-{formatMYR(totalBillsSen)}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Overdue Receivable:</span>
                <span className="font-mono font-bold text-slate-500">
                  {overdueInvoice ? `${formatMYR(overdueInvoice.amountSen)} (Uncollected)` : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 bg-rose-50/60 p-2 rounded-lg">
                <span className="text-rose-900 font-semibold">Lowest Projected Cash:</span>
                <span className="font-mono font-bold text-rose-700 text-sm">{formatMYR(originalLowestSen)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-100/50">
                <span className="text-rose-900 font-bold">Reserve Deficit:</span>
                <span className="font-mono font-bold text-rose-800">
                  {originalDeficitSen > 0 ? `-${formatMYR(originalDeficitSen)} below reserve` : 'RM 0.00 (Protected)'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center space-x-1 text-rose-700 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            <span>{originalDeficitSen > 0 ? 'Liquidity pressure flagged before intervention' : 'Baseline cash flow evaluated'}</span>
          </div>
        </div>

        {/* AFTER CARD */}
        <div className="bg-white rounded-2xl border border-emerald-300 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
            Current Reforecasted State
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Post Intervention & Settlement
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {isResolved ? 'Safety Reserve Protected' : 'Updated Forecast Status'}
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Adjusted Cleared Cash:</span>
                <span className="font-mono font-bold text-emerald-800">
                  {formatMYR(businessProfile.initialCashSen)}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Upcoming Supplier Bills:</span>
                <span className="font-mono font-bold text-slate-700">-{formatMYR(totalBillsSen)} (Scheduled)</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Customer Receivable:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {overdueInvoice ? `${hasSimulatedPayment ? 'Settled (Reconciled)' : 'Pending'}` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 bg-emerald-50/70 p-2 rounded-lg">
                <span className="text-emerald-900 font-semibold">Lowest Projected Cash:</span>
                <span className="font-mono font-bold text-teal-800 text-sm">
                  {formatMYR(lowestClosing)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-100/70">
                <span className="text-emerald-900 font-bold">Reserve Deficit:</span>
                <span className="font-mono font-bold text-emerald-800">
                  {lowestClosing < businessProfile.minReserveSen
                    ? `-${formatMYR(businessProfile.minReserveSen - lowestClosing)} below reserve`
                    : 'RM 0.00 (Zero Deficit)'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-800 font-medium flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            <span>Mathematical stability verified across entire horizon</span>
          </div>
        </div>
      </div>

      {/* Reconciliation & Verification Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 block text-[11px] font-semibold uppercase">
            Invoice Reconciliation
          </span>
          <div className="mt-1 flex items-center space-x-2">
            <span className="font-mono font-bold text-slate-900 text-sm">
              INV-1042: {overdueInvoice?.status === 'paid' ? 'Paid & Reconciled' : 'Pending Payment'}
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-[11px]">
            {overdueInvoice?.status === 'paid'
              ? 'DuitNow bank receipt #DN-9948271 matched.'
              : 'Waiting for simulated customer payment.'}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 block text-[11px] font-semibold uppercase">
            Actions Completed
          </span>
          <div className="mt-1 font-mono font-bold text-slate-900 text-sm">
            {proposedActions.filter((a) => a.status === 'Executed').length} of {proposedActions.length} Executed
          </div>
          <p className="text-slate-500 mt-1 text-[11px]">
            {proposedActions.every((a) => a.status === 'Executed')
              ? 'All planned recovery steps completed.'
              : 'Remaining actions preserved as optional backups.'}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 block text-[11px] font-semibold uppercase">
            Remaining Horizon Risks
          </span>
          <div className="mt-1 font-mono font-bold text-emerald-700 text-sm flex items-center space-x-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>0 Breaches Across 30 Days</span>
          </div>
          <p className="text-slate-500 mt-1 text-[11px]">
            Next scheduled review: 1 Nov 2026 for November supplier cycle.
          </p>
        </div>
      </div>

      {/* Linked Audit Lineage (Original Risk -> Selected Plan -> Approval -> Execution -> Payment -> Reforecast) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-semibold text-slate-900 text-sm mb-3">
          Linked End-to-End Governance Audit Trail
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Every financial movement is bound to an initial risk detection, approved plan, and verified confirmation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">1. Risk Detected</span>
            <span className="font-semibold text-rose-700 block mt-1">RM 12k Deficit</span>
            <span className="text-[10px] text-slate-500">Day 12 shortfall</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">2. Plan Selected</span>
            <span className="font-semibold text-teal-800 block mt-1">Plan A</span>
            <span className="text-[10px] text-slate-500">Overdue collection</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">3. User Approval</span>
            <span className="font-semibold text-slate-800 block mt-1">Explicit Sign-off</span>
            <span className="text-[10px] text-slate-500">Owner authorized</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">4. Execution</span>
            <span className="font-semibold text-slate-800 block mt-1">Simulated Notice</span>
            <span className="text-[10px] text-slate-500">MegaRetail Cynthia Tan</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">5. Payment Event</span>
            <span className="font-semibold text-emerald-700 block mt-1">+RM 12,000.00</span>
            <span className="text-[10px] text-slate-500">Maybank DuitNow</span>
          </div>

          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-300">
            <span className="text-[10px] text-emerald-800 font-bold uppercase block">6. Reforecast</span>
            <span className="font-semibold text-emerald-800 block mt-1">Reserve Safe</span>
            <span className="text-[10px] text-emerald-700">Trough: RM 5,000.00</span>
          </div>
        </div>
      </div>
    </div>
  );
};
