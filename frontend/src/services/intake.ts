import { apiRequest } from './api';

export type IntakeModule = 'carbon_analysis' | 'financial_analysis' | 'transition_analysis';
export type EvidenceQuality = 'UNKNOWN' | 'DIRECT_MEASURED' | 'INVOICE_DERIVED' | 'ESTIMATED_PROXY';
export interface Readiness {
  status: 'READY' | 'PARTIAL' | 'BLOCKED'; reasons: string[];
  partial_accepted: boolean; may_proceed: boolean;
}
export interface ValueEvidence {
  field: string; source_file: string; source_document_id: string | null;
  original_column: string; original_metric: string | null; row: number; sheet: string | null;
  original_value: unknown; original_unit: string | null; normalized_value: string | number;
  normalized_unit: string | null; reporting_period: string | null; extraction_method: string;
  mapping_method: string | null; evidence_quality: EvidenceQuality;
  evidence_quality_basis: string | null; confirmation_status: string;
  confirmed_by: string | null; confirmed_at: string | null; externally_verified: false;
}
export interface MappingDecision {
  request_id: string; action: 'confirm' | 'ignore'; mapped_field?: string | null; unit?: string | null;
}
export interface IntakeResult {
  company: Record<string, string | number | null>;
  normalized_data: {
    metadata: Record<string, string | number | null>;
    financial: Record<string, number | null>;
    activity: Record<string, number | null>;
    provenance: Record<string, unknown[]>;
    mappings: unknown[]; unmapped_fields: string[]; warnings: unknown[];
  } | null;
  evidence: ValueEvidence[];
  data_gaps: { gap_type: string; affected_field: string | null; severity: string; message: string; recommended_action: string }[];
  readiness: Record<IntakeModule, Readiness>;
  agent_next_action: 'PROCEED' | 'REQUEST_EVIDENCE' | 'REQUEST_CONFIRMATION' | 'BLOCK';
  requested_modules: IntakeModule[]; partial_acceptances: unknown[];
  mapping_requests: { request_id: string; file_id: string; original_column: string; row: number | null;
    sheet: string | null; detected_unit: string | null; deterministic_field: string | null; reason: string }[];
  suggestions: { request_id: string; suggested_field: string | null; reasoning: string; requires_confirmation: true }[];
  errors: { stage: string; file_id: string | null; message: string }[];
  notices: string[]; intake_status: string;
}
export interface IntakeSession {
  intake_id: string; access_token: string; reviewer: string; result: IntakeResult;
  awaiting: 'mapping' | 'evidence' | null; can_continue_incomplete: boolean;
  files: { file_id: string; filename: string; size: number }[];
  schema_fields: Record<string, string | null>;
}
export interface EvidenceDeclaration { quality: EvidenceQuality; basis: string }
export type IntakeResume = { decisions: MappingDecision[] } | {
  action: 'upload' | 'continue_incomplete' | 'cancel'; reason: string; remove_file_ids?: string[];
};
const base = (import.meta.env?.VITE_INTAKE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const storageKey = 'greenbridge_intake_session';
export function rememberIntake(session: IntakeSession) {
  sessionStorage.setItem(storageKey, JSON.stringify({ intake_id: session.intake_id, access_token: session.access_token }));
}
export function savedIntake(): Pick<IntakeSession, 'intake_id' | 'access_token'> | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    return typeof value?.intake_id === 'string' && typeof value?.access_token === 'string' ? value : null;
  } catch { return null; }
}
export function forgetIntake() { sessionStorage.removeItem(storageKey); }
function form(files: File[], declaration: EvidenceDeclaration) {
  const body = new FormData();
  files.forEach(file => body.append('files', file));
  body.append('evidence_quality', declaration.quality);
  if (declaration.basis.trim()) body.append('quality_basis', declaration.basis.trim());
  return body;
}
async function request(path: string, options: Parameters<typeof apiRequest>[1] = {}): Promise<IntakeSession> {
  try { return await apiRequest<IntakeSession>(`${base}/api/intake${path}`, { timeoutMs: 120000, ...options }); }
  catch (error) {
    const details = (error as { details?: { detail?: unknown } }).details;
    if (typeof details?.detail === 'string') throw new Error(details.detail);
    throw error;
  }
}
export function startIntake(files: File[], reviewer: string, modules: IntakeModule[], declaration: EvidenceDeclaration) {
  const body = form(files, declaration);
  body.append('reviewer', reviewer.trim());
  body.append('requested_modules', JSON.stringify(modules));
  return request('/start', { method: 'POST', body });
}
export function resumeIntake(session: Pick<IntakeSession, 'intake_id' | 'access_token'>,
  response: IntakeResume, files: File[] = [], declaration: EvidenceDeclaration = { quality: 'UNKNOWN', basis: '' }) {
  const body = form(files, declaration);
  body.append('response', JSON.stringify(response));
  return request(`/${encodeURIComponent(session.intake_id)}/resume`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body,
  });
}
export function getIntake(session: Pick<IntakeSession, 'intake_id' | 'access_token'>) {
  return request(`/${encodeURIComponent(session.intake_id)}/result`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}
export function intakeMayProceed(result: IntakeResult) {
  return result.agent_next_action === 'PROCEED' && result.normalized_data !== null
    && result.requested_modules.every(module => result.readiness[module].may_proceed);
}
