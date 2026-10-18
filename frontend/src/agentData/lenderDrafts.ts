import { AuditLogEntry, UserRole } from '../types/transition';
import { requirePermission } from '../auth/permissions';
export interface LenderDraft {
  companyId: string; reportingYear: number; packageName: string; disclosures: Record<string, boolean>;
  fingerprint: string; status: 'DRAFT' | 'APPROVED' | 'REJECTED'; preparedBy: UserRole;
  updatedAt: string; reason?: string;
}
const draftKey = (company: string) => `greenbridge_pack_draft:${company}`;
const auditKey = (company: string) => `greenbridge_disclosure_audit:${company}`;
export function readDraft(company: string): LenderDraft | null {
  try { const draft = JSON.parse(localStorage.getItem(draftKey(company)) || 'null'); return draft?.companyId === company ? draft : null; } catch { return null; }
}
export function readDisclosureAudit(company: string): AuditLogEntry[] {
  try { const events = JSON.parse(localStorage.getItem(auditKey(company)) || '[]'); return Array.isArray(events) ? events : []; } catch { return []; }
}
function record(company: string, role: UserRole, action: string, details: string) {
  const entry: AuditLogEntry = { id: `DEMO-${crypto.randomUUID()}`, timestamp: new Date().toISOString(), userRole: role, action, details, category: 'LENDER_DISCLOSURE' };
  localStorage.setItem(auditKey(company), JSON.stringify([entry, ...readDisclosureAudit(company)]));
}
export function saveDraft(role: UserRole, input: Omit<LenderDraft, 'status' | 'preparedBy' | 'updatedAt'>): LenderDraft {
  requirePermission(role, 'prepare_pack');
  const draft: LenderDraft = { ...input, status: 'DRAFT', preparedBy: role, updatedAt: new Date().toISOString() };
  localStorage.setItem(draftKey(input.companyId), JSON.stringify(draft));
  record(input.companyId, role, 'Lender pack draft prepared', `${input.packageName}: awaiting SME Owner disclosure decision (local demo record).`);
  return draft;
}
export function decideDraft(role: UserRole, draft: LenderDraft, status: 'APPROVED' | 'REJECTED', reason?: string): LenderDraft {
  requirePermission(role, 'approve_disclosure');
  if (status === 'REJECTED' && !reason?.trim()) throw new Error('Please provide a rejection reason.');
  const updated = { ...draft, status, reason, updatedAt: new Date().toISOString() };
  localStorage.setItem(draftKey(draft.companyId), JSON.stringify(updated));
  record(draft.companyId, role, `Disclosure ${status.toLowerCase()}`, `${draft.packageName}${reason ? ': ' + reason : ''} (local demo record).`);
  return updated;
}
