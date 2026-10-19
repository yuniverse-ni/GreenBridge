import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileText, RefreshCw, Download, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTransition } from '../context/TransitionContext';
import { ROLE_LABELS } from '../auth/permissions';
import {
  EvidenceQuality, IntakeModule, IntakeResult, IntakeResume, IntakeSession, MappingDecision,
  forgetIntake, getIntake, intakeMayProceed, rememberIntake, resumeIntake, savedIntake, startIntake,
} from '../services/intake';

const MODULES: Record<IntakeModule, string> = {
  financial_analysis: 'Financial', carbon_analysis: 'Carbon', transition_analysis: 'Transition',
};
const REQUESTED_MODULES = Object.keys(MODULES) as IntakeModule[];

export function continueToOverview(result: IntakeResult, navigate: (page: 'overview') => void) {
  if (intakeMayProceed(result)) navigate('overview');
}
const label = (field: string) => field.replace(/_/g, ' ');
const display = (value: unknown) => value == null ? 'Missing — not supplied' : String(value);

interface ReviewIssue { title: string; status: string; action: string }
/** Group presentation only. Original checks and permissions remain untouched. */
export function readinessIssues(session: IntakeSession): ReviewIssue[] {
  const issues = new Map<string, ReviewIssue>();
  const add = (key: string, title: string, status: string, action: string) => {
    if (!issues.has(key)) issues.set(key, { title, status, action });
  };
  for (const gap of session.result.data_gaps) {
    switch (gap.gap_type) {
      case 'MISSING_PERIOD': case 'INCOMPLETE_PERIOD':
        add('period', 'Reporting period', gap.gap_type === 'MISSING_PERIOD' ? 'Missing' : 'Incomplete', 'Add dated records covering the reporting period.'); break;
      case 'UNKNOWN_EVIDENCE_QUALITY': case 'ESTIMATED_EVIDENCE':
        add('quality', 'Evidence quality', gap.gap_type === 'UNKNOWN_EVIDENCE_QUALITY' ? 'Not declared' : 'Needs review', 'Provide source information or confirm that you accept the evidence limitations.'); break;
      case 'MISSING_CONTEXT':
        if (gap.affected_field === 'reporting_year') add('period', 'Reporting period', 'Missing', 'Add the reporting year to your records.');
        else add('company', 'Business details', 'Missing', 'Add the required company details to your records.');
        break;
      case 'MISSING_FINANCIAL':
        add('financial', 'Financial information', 'Incomplete', 'Add the missing financial information or review whether you can continue with limitations.'); break;
      case 'MISSING_ACTIVITY': case 'ACTIVITY_APPLICABILITY':
        add('activity', 'Energy and fuel records', 'Incomplete', 'Add the relevant activity records or review which sources apply to your business.'); break;
      case 'DUPLICATE_FILE': case 'OVERLAPPING_EVIDENCE':
        add('overlap', 'Overlapping records', 'Needs review', 'Remove duplicate files or supply records for separate reporting periods.'); break;
      default:
        add('validation', 'Data checks', 'Needs review', 'Check your source records and correct the outstanding validation issues.');
    }
  }
  if (session.result.mapping_requests.length) add('mapping', 'Field matching', 'Confirmation needed', 'Confirm the column meanings and input units in Technical details.');
  if (session.result.errors.length) add('validation', 'Data checks', 'Needs review', 'Correct or replace the affected records using the checks in Technical details.');
  if (!issues.size && !intakeMayProceed(session.result)) add('review', 'Required information', 'Needs review', 'Review the outstanding checks in Technical details before continuing.');
  return [...issues.values()];
}

/** Presentation only: render the server contract, never calculate business values. */
export function IntakeResultPanel({ session, children, busy = false, onContinue, onAcceptPartial }: {
  session: IntakeSession; children?: React.ReactNode; busy?: boolean;
  onContinue?: () => void; onAcceptPartial?: (reason: string) => void | Promise<void>;
}) {
  const { result } = session;
  const dataset = result.normalized_data;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [acceptanceOpen, setAcceptanceOpen] = useState(false);
  const [acceptanceReason, setAcceptanceReason] = useState('');
  const requested = result.requested_modules.map(module => result.readiness[module]);
  // Presentation rollup only; permissions still come from DataIntakeResult.
  const status = result.agent_next_action === 'BLOCK' || requested.some(item => item.status === 'BLOCKED') ? 'BLOCKED'
    : requested.some(item => item.status === 'PARTIAL') ? 'PARTIAL' : 'READY';
  const message = status === 'READY' ? 'Your data is ready for analysis.'
    : status === 'BLOCKED' ? 'Some required information must be resolved before analysis.'
    : 'Some information needs review before analysis.';
  const issues = readinessIssues(session);
  const mayAcceptPartial = status === 'PARTIAL' && session.awaiting === 'evidence' && session.can_continue_incomplete;
  const mayContinue = intakeMayProceed(result) || mayAcceptPartial;
  return <section className="gb-panel gb-intake-result" aria-label="Data Intake Result" aria-live="polite">
    <div className="gb-intake-result-heading"><h2>Data readiness</h2>
      <span className={`gb-intake-status gb-intake-status-${status.toLowerCase()}`}>{status === 'READY' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{status}</span></div>
    <p className="gb-intake-result-message">{message}</p>
    {status !== 'READY' && <p className="gb-intake-attention"><AlertCircle size={15} /> {issues.length} {issues.length === 1 ? 'item needs' : 'items need'} attention</p>}
    <div className="gb-intake-result-actions">
      {status !== 'READY' && <button className="gb-button" disabled={busy} aria-expanded={reviewOpen} onClick={() => setReviewOpen(previous => !previous)}>Review</button>}
      {status !== 'BLOCKED' && <button className="gb-button gb-primary" disabled={busy || !mayContinue} onClick={() => {
        if (intakeMayProceed(result)) onContinue?.();
        else if (mayAcceptPartial) setAcceptanceOpen(true);
      }}>Continue <ArrowRight size={14} /></button>}
    </div>
    {reviewOpen && <section className="gb-intake-grouped-review" aria-label="Items to review"><ul>
      {issues.map(issue => <li key={issue.title}><h3>{issue.title} — {issue.status}</h3><p>{issue.action}</p></li>)}
    </ul></section>}
    {acceptanceOpen && mayAcceptPartial && <section className="gb-intake-partial-confirmation" aria-label="Confirm incomplete data">
      <h3>Continue with incomplete data?</h3><p>Review the items that need attention. Your data will remain PARTIAL and the limitations will be recorded.</p>
      <label>Reason for continuing<textarea className="border rounded p-2 w-full" disabled={busy} value={acceptanceReason} onChange={event => setAcceptanceReason(event.target.value)} /></label>
      <div className="gb-header-actions"><button className="gb-button gb-primary" disabled={busy || !acceptanceReason.trim()}
        onClick={() => void onAcceptPartial?.(acceptanceReason)}>Accept limitations and continue</button>
        <button className="gb-button" disabled={busy} onClick={() => setAcceptanceOpen(false)}>Back</button></div>
    </section>}
    <details className="gb-intake-details"><summary>Technical details</summary><div className="gb-intake-detail-content">
    {Object.entries(MODULES).map(([module, name]) => <section key={module}><h3>{name} readiness: {result.readiness[module as IntakeModule].status}</h3>
      {result.readiness[module as IntakeModule].partial_accepted && <p>PARTIAL explicitly accepted</p>}
      <ul>{result.readiness[module as IntakeModule].reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></section>)}
    {result.errors.length > 0 && <div role="alert"><h3>Validation issues</h3><ul>{result.errors.map((error, i) => <li key={i}>{error.stage}: {error.message}</li>)}</ul></div>}
    {result.data_gaps.length > 0 && <section><h3>Evidence gaps ({result.data_gaps.length})</h3>
      <ul>{result.data_gaps.map((gap, i) => <li key={i}><strong>{gap.severity}: </strong>{gap.message} {gap.recommended_action}</li>)}</ul></section>}
    {result.notices.map((notice, i) => <p key={i}>{notice}</p>)}
    {dataset ? <>
      <h3>Extracted data</h3><p>Missing values are marked below. Evidence quality is based on the information supplied.</p>
      <div className="gb-table-scroll"><table><thead><tr><th>Group</th><th>Field</th><th>Value</th><th>Normalized unit</th></tr></thead><tbody>
        {(['metadata', 'financial', 'activity'] as const).flatMap(group => Object.entries(dataset[group]).map(([field, value]) =>
          <tr key={`${group}:${field}`}><td>{group}</td><td>{label(field)}</td><td>{display(value)}</td><td>{session.schema_fields[field] ?? '—'}</td></tr>))}
      </tbody></table></div>
      <details><summary>Evidence &amp; provenance — preview {Math.min(50, result.evidence.length)} of {result.evidence.length} values</summary>
        <div className="gb-table-scroll"><table><thead><tr><th>Source / location</th><th>Field</th><th>Original</th><th>Normalized</th><th>Evidence quality / confirmation</th></tr></thead><tbody>
          {result.evidence.slice(0, 50).map((item, i) => <tr key={i}>
            <td>{item.source_file}{item.sheet ? ` / ${item.sheet}` : ''} / row {item.row} / {item.original_column}<small>{item.reporting_period ?? 'Period not supplied'}</small></td>
            <td>{item.field}</td><td>{display(item.original_value)} {item.original_unit}</td><td>{item.normalized_value} {item.normalized_unit}</td>
            <td>{item.evidence_quality} / {item.confirmation_status}<small>{item.confirmed_by ?? ''} {item.evidence_quality_basis ?? ''}</small></td>
          </tr>)}
        </tbody></table></div>
      </details>
      <a className="gb-button" download={`intake-${session.intake_id}.json`}
        href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(result, null, 2))}`}><Download size={14} /> Download full result &amp; provenance</a>
    </> : <p>Data will be available once the required checks and confirmations are complete.</p>}
    {children}
    </div></details>
  </section>;
}

export const DataIngestionView: React.FC = () => {
  const { currentRole, setActiveTab } = useTransition();
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState<EvidenceQuality>('UNKNOWN');
  const [basis, setBasis] = useState('');
  const [reason, setReason] = useState('');
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, MappingDecision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function accept(next: IntakeSession) {
    setSession(next); rememberIntake(next); setFiles([]); setRemoveIds([]); setReason('');
    setDecisions(Object.fromEntries(next.result.mapping_requests.map(item => [item.request_id, {
      request_id: item.request_id, action: 'confirm',
      mapped_field: item.deterministic_field ?? next.result.suggestions.find(s => s.request_id === item.request_id)?.suggested_field ?? '',
      unit: item.detected_unit ?? '',
    }])));
  }
  useEffect(() => {
    let mounted = true;
    const saved = savedIntake();
    if (saved) {
      setBusy(true);
      getIntake(saved).then(next => { if (mounted) accept(next); })
        .catch(error => { if (mounted) { setError(error.message); forgetIntake(); } })
        .finally(() => { if (mounted) setBusy(false); });
    }
    return () => { mounted = false; };
  }, []);
  async function run(operation: () => Promise<IntakeSession>) {
    if (busy) return;
    setBusy(true); setError('');
    try { const next = await operation(); accept(next); return next; }
    catch (error) { setError(error instanceof Error ? error.message : 'Intake request failed.'); }
    finally { setBusy(false); }
  }
  function chooseFiles(selected: FileList | File[]) {
    if (busy) return;
    const next = Array.from(selected);
    if (next.some(file => !/\.(csv|xlsx)$/i.test(file.name))) {
      setError('Choose a CSV or XLSX file.'); return;
    }
    if (next.length > 10 || next.some(file => file.size > 30 * 1024 * 1024)) {
      setError('Choose at most 10 files, each at most 30 MB.'); return;
    }
    setError(''); setFiles(next);
  }
  const declaration = { quality, basis };
  const declarationValid = quality === 'UNKNOWN' || !!basis.trim();
  const canUpload = !session || session.awaiting === 'evidence';
  function resume(response: IntakeResume, uploads: File[] = []) {
    if (session) void run(() => resumeIntake(session, response, uploads, declaration));
  }
  function mappingChange(id: string, change: Partial<MappingDecision>) {
    setDecisions(previous => ({ ...previous, [id]: { ...previous[id], ...change } }));
  }
  const template = 'company_id,company_name,reporting_year,reporting_period,revenue,operating_expenses,cash_balance,annual_debt_service,capex_budget,minimum_cash_reserve,cogs,operating_cash_flow,total_debt,current_liabilities,electricity_kwh,diesel_litres,petrol_litres,natural_gas_m3,lpg_kg\n';

  const uploadArea = canUpload ? <>
      <div className={`gb-document-dropzone border-2 border-dashed rounded-2xl p-8 text-center ${dragging ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-300'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); chooseFiles(e.dataTransfer.files); }}>
        <div className="gb-intake-upload-icon"><UploadCloud size={24} /></div><h2>{session ? 'Add or replace files' : 'Upload your business data'}</h2>
        <p>Drag and drop your files here, or choose files from your device.</p>
        <input ref={input} type="file" multiple accept=".csv,.xlsx" className="hidden" aria-label="Choose intake files" disabled={busy}
          onChange={e => { if (e.target.files) chooseFiles(e.target.files); e.target.value = ''; }} />
        <button className="gb-button" disabled={busy} onClick={() => input.current?.click()}>Browse files</button>
        <p className="gb-intake-file-hint">CSV or XLSX · Up to 10 files · 30 MB per file</p>
        {files.length > 0 && <ul className="gb-intake-selected-files">{files.map((file, i) => <li key={i}><FileText size={16} /><span>{file.name}</span><small>{(file.size / 1024).toLocaleString('en-MY', { maximumFractionDigits: 1 })} KB</small></li>)}</ul>}
      </div>
      {files.length > 0 && <details className="gb-panel gb-intake-metadata"><summary>Evidence quality <span>Optional</span></summary>
        <p>Add source information to help assess the reliability of these files.</p>
        <label>Evidence quality <select value={quality} disabled={busy} className="border rounded p-2" onChange={e => setQuality(e.target.value as EvidenceQuality)}>
          <option value="UNKNOWN">Unknown / not declared</option><option value="DIRECT_MEASURED">Direct measured</option>
          <option value="INVOICE_DERIVED">Invoice derived</option><option value="ESTIMATED_PROXY">Estimated / proxy</option>
        </select></label>
        <label className="block mt-2">Source / basis <input className="border rounded p-2 w-full" value={basis} disabled={busy} onChange={e => setBasis(e.target.value)} placeholder="Required when specifying evidence quality" /></label>
        {!declarationValid && <p role="status">Add a source or basis for the selected evidence quality.</p>}
      </details>}
      {!session && <div className="gb-intake-action-bar"><p>{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Select files to get started.'}</p>
        <button className="gb-button gb-primary" disabled={busy || !files.length || !declarationValid}
          onClick={() => void run(() => startIntake(files, ROLE_LABELS[currentRole], REQUESTED_MODULES, declaration))}>Analyse data <ArrowRight size={14} /></button></div>}
  </> : null;

  return <div className="gb-documents-page gb-documents-intake">
    <div className="gb-page-heading gb-documents-heading"><div><h1>Data &amp; Documents</h1>
      <p>Bring your business data together and check its readiness for analysis.</p></div>
      <div className="gb-header-actions"><a className="gb-button" download="Intake_Template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}><Download size={14} /> CSV template</a>
        {session && <button className="gb-button" disabled={busy} onClick={() => { forgetIntake(); setSession(null); setFiles([]); setQuality('UNKNOWN'); setBasis(''); setError(''); }}>New analysis</button>}
      </div></div>
    {error && <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-900">{error}</div>}
    <ol className="gb-intake-steps" aria-label="Data analysis steps">{['Upload', 'Analyse', 'Readiness', 'Continue'].map((step, index) =>
      <li key={step} aria-current={index === (busy ? 1 : session ? 2 : 0) ? 'step' : undefined}><span>{index + 1}</span>{step}</li>)}</ol>
    {!session && uploadArea}
    {busy && <p role="status" className="gb-intake-processing"><RefreshCw size={16} className="inline animate-spin" /> Analysing your data…</p>}
    {session && <>
      <IntakeResultPanel key={session.intake_id} session={session} busy={busy} onContinue={() => continueToOverview(session.result, setActiveTab)}
        onAcceptPartial={async reason => {
          const next = await run(() => resumeIntake(session, { action: 'continue_incomplete', reason }));
          if (next) continueToOverview(next.result, setActiveTab);
        }}>
      {uploadArea}
      <section className="gb-panel"><h3>Source files</h3><ul>{session.files.map(file => <li key={file.file_id}>
        {session.awaiting === 'evidence' && <input type="checkbox" aria-label={`Remove ${file.filename}`} disabled={busy} checked={removeIds.includes(file.file_id)}
          onChange={e => setRemoveIds(previous => e.target.checked ? [...previous, file.file_id] : previous.filter(id => id !== file.file_id))} />}
        {' '}{file.filename} — {file.size.toLocaleString()} bytes {removeIds.includes(file.file_id) ? '(remove on update)' : ''}
      </li>)}</ul></section>
      {session.awaiting === 'mapping' && <section className="gb-panel"><h2>Confirm field mappings</h2>
        <p>Suggestions are unconfirmed. Choose the field and original input unit, or explicitly ignore it.</p>
        {session.result.mapping_requests.map(item => {
          const decision = decisions[item.request_id];
          return <fieldset key={item.request_id} disabled={busy} className="border rounded-xl p-4 my-3">
            <legend>{item.original_column} — {session.files.find(file => file.file_id === item.file_id)?.filename}{item.sheet ? ` / ${item.sheet}` : ''}{item.row ? ` / row ${item.row}` : ''}</legend>
            <p>{item.reason}</p><p>{session.result.suggestions.find(s => s.request_id === item.request_id)?.reasoning}</p>
            <label>Decision <select value={decision?.action ?? 'confirm'} onChange={e => mappingChange(item.request_id, { action: e.target.value as 'confirm' | 'ignore' })}>
              <option value="confirm">Confirm / correct</option><option value="ignore">Ignore this source field</option></select></label>
            {decision?.action !== 'ignore' && <>
              <label className="block">Normalized field <select className="border rounded p-2" value={decision?.mapped_field ?? ''} onChange={e => mappingChange(item.request_id, { mapped_field: e.target.value })}>
                <option value="">Choose field</option>{Object.keys(session.schema_fields).map(field => <option key={field} value={field}>{label(field)}</option>)}</select></label>
              <label className="block">Original input unit <input className="border rounded p-2" value={decision?.unit ?? ''} onChange={e => mappingChange(item.request_id, { unit: e.target.value })} placeholder="e.g. MWh, kWh, RM, litres; blank for text" /></label>
            </>}
          </fieldset>;
        })}
        <button className="gb-button gb-primary" disabled={busy || session.result.mapping_requests.some(item => !decisions[item.request_id]
          || (decisions[item.request_id].action === 'confirm' && !decisions[item.request_id].mapped_field))}
          onClick={() => resume({ decisions: session.result.mapping_requests.map(item => {
            const decision = decisions[item.request_id];
            return decision.action === 'ignore' ? { request_id: item.request_id, action: 'ignore' }
              : { ...decision, unit: decision.unit?.trim() || null };
          }) })}>Confirm mappings &amp; resume</button>
      </section>}
      {session.awaiting === 'evidence' && <section className="gb-panel"><h2>Evidence clarification</h2>
        <p>Upload additional records or select files above to remove/replace them. BLOCKED readiness cannot be overridden.</p>
        <label className="block">Reason for this decision <textarea className="border rounded p-2 w-full" value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
        <div className="gb-header-actions mt-3">
          <button className="gb-button gb-primary" disabled={busy || !reason.trim() || (!files.length && !removeIds.length) || !declarationValid}
            onClick={() => resume({ action: 'upload', reason, remove_file_ids: removeIds }, files)}>Update evidence &amp; resume</button>
          <button className="gb-button" disabled={busy || !reason.trim() || !session.can_continue_incomplete}
            onClick={() => resume({ action: 'continue_incomplete', reason })}>Accept PARTIAL evidence &amp; publish</button>
          <button className="gb-button" disabled={busy || !reason.trim()} onClick={() => resume({ action: 'cancel', reason })}>Cancel analysis</button>
        </div>
      </section>}
      </IntakeResultPanel>
    </>}
    <details className="gb-panel gb-intake-supported"><summary>Supported data</summary>
      <p>Upload CSV or XLSX records containing company details, financial figures and energy or fuel consumption. Use the CSV template to organise your data.</p>
      <p>Optional financial detail: cost of goods sold (COGS), operating cash flow, total debt and current liabilities. Leave unknown amounts blank; operating cash flow may be negative.</p>
      <p>Include the reporting year, period and relevant units. Keep monthly activity records separate and financial figures consistent across files.</p>
    </details>
  </div>;
};
