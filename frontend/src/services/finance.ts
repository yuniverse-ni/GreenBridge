import { apiRequest } from './api';
import { IntakeSession, Readiness, ValueEvidence } from './intake';

export interface FinanceMetric {
  value: number | null; formatted: string; is_calculable: boolean;
  status: string; explanation: string; formula: string;
}
export interface FinanceResult {
  company_id: string; reporting_year: number; currency: 'MYR'; source: string; origin: 'SERVICE';
  inputs: Record<string, number | null>;
  gross_profit: number | null; ebitda: number | null; cash_above_reserve: number | null;
  cash_balance: number | null; capex_budget: number | null; minimum_cash_reserve: number | null;
  existing_annual_debt_service: number | null; annual_cash_available_for_debt_service: number | null;
  minimum_dscr: number | null; metrics: Record<string, FinanceMetric>;
  financial_provenance: Record<string, unknown[]>; evidence: ValueEvidence[];
  readiness: Readiness; assumptions: string[]; evidence_limitations: string[];
}
export interface FinanceResponse { data: FinanceResult | null; missing_context: string[] }

const base = (import.meta.env?.VITE_INTAKE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
export async function getFinance(intake: Pick<IntakeSession, 'intake_id' | 'access_token'>): Promise<FinanceResponse> {
  try {
    return await apiRequest<FinanceResponse>(`${base}/api/finance/intakes/${encodeURIComponent(intake.intake_id)}/result`, {
      headers: { Authorization: `Bearer ${intake.access_token}` }, timeoutMs: 120000,
    });
  } catch (error) {
    const detail = (error as { details?: { detail?: unknown } }).details?.detail;
    if (typeof detail === 'string') throw new Error(detail);
    throw error;
  }
}
