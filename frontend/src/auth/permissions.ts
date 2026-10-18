import { TransitionTab, UserRole } from '../types/transition';

export const ROLE_LABELS: Record<UserRole, string> = {
  sme_owner: 'SME Owner', finance_manager: 'Finance Manager', lender: 'Lender / Credit Reviewer',
};
export type Permission = 'manage_data' | 'select_actions' | 'ask_copilot' | 'prepare_pack' | 'approve_disclosure';
const INTERNAL_PAGES: TransitionTab[] = ['overview', 'ingestion', 'baseline', 'financials', 'actions', 'copilot', 'transition-plan', 'audit', 'legal-governance'];
export function canAccessPage(role: UserRole, page: string): boolean {
  if (role === 'lender') return page === 'transition-plan';
  return INTERNAL_PAGES.includes(page as TransitionTab) || (role === 'sme_owner' && page === 'test-suite');
}
export function can(role: UserRole, permission: Permission): boolean {
  if (permission === 'approve_disclosure') return role === 'sme_owner';
  return role === 'sme_owner' || role === 'finance_manager';
}
export function requirePermission(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) throw new Error('Access denied: this action is not permitted for your role.');
}
