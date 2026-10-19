import { apiRequest } from './api';
import { IntakeResult, IntakeSession, Readiness } from './intake';

export interface Objective {
  mode: 'PLAN_TRANSITION' | 'ASSESS_CARBON' | 'ASSESS_FINANCIAL';
  focus: 'CARBON' | 'COST' | 'BALANCED'; description: string;
  constraints: Record<string, number | null>;
  funding: { mode: 'CASH_ONLY' | 'FINANCE_IF_NEEDED'; grant_amount: number | null;
    maximum_sme_contribution: number | null; terms: { annual_interest_rate_pct: number; tenure_years: number } | null };
  action_ids: string[];
}
export interface CarbonSourceResult {
  source: string; scope: 'Scope 1' | 'Scope 2'; reporting_year: number;
  activity_value: number | null; activity_unit: string;
  factor_kgco2e_per_unit: number | null; factor_unit: string | null;
  factor_source: string | null; factor_version: string | null; factor_region: string | null;
  emissions_kgco2e: number | null; emissions_tco2e: number | null;
  share_pct: number | null; evidence: {
    source_file: string; row: number; sheet: string | null; reporting_period: string | null;
    original_column: string; original_metric: string | null; original_value: unknown;
    original_unit: string | null; normalized_unit: string | null;
    evidence_quality: 'DIRECT_MEASURED' | 'INVOICE_DERIVED' | 'ESTIMATED_PROXY' | 'UNKNOWN';
    evidence_quality_basis: string | null; mapping_confidence: number | null;
    semantic_confidence: number | null; confirmation_status: 'ACCEPTED' | 'CONFIRMED';
  }[];
}
export interface CarbonResult {
  company_id: string; reporting_year: number; source: string; origin: 'SERVICE' | 'TEST_DOUBLE';
  scope1_emissions_tco2e: number | null; scope2_emissions_tco2e: number | null;
  total_tco2e: number | null; activity_data_complete: boolean; emissions_by_source: CarbonSourceResult[];
  carbon_intensity: { value: number; unit: 'kgCO2e/m2'; floor_area_m2: number } | null;
  data_confidence: {
    activity_source_count: number; evidenced_source_count: number; evidence_record_count: number;
    evidence_quality_counts: Record<string, number>;
  };
  missing_data: string[]; warnings: string[];
  factor_provenance: {
    source: string; scope: 'Scope 1' | 'Scope 2'; factor_kgco2e_per_unit: number;
    factor_unit: string; factor_source: string; factor_version: string; factor_region: string | null;
  }[];
  assumptions: string[]; evidence_limitations: string[];
}
export function isCarbonResult(value: unknown): value is CarbonResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<CarbonResult>;
  return typeof result.company_id === 'string'
    && typeof result.reporting_year === 'number'
    && (typeof result.total_tco2e === 'number' || result.total_tco2e === null)
    && typeof result.activity_data_complete === 'boolean'
    && Array.isArray(result.emissions_by_source)
    && Array.isArray(result.factor_provenance)
    && Array.isArray(result.missing_data)
    && Array.isArray(result.warnings);
}
interface Pathway {
  pathway_id: string; name: string; capex: number; annual_savings: number | null;
  annual_emissions_reduction_tco2e: number | null; simple_payback_years: number | null;
  remaining_cash: number | null; financing_principal: number | null;
}
export interface AgentRun {
  run_id: string; intake_id: string; revision: number; awaiting: 'context' | 'human_review' | null;
  service_status: Record<string, 'AVAILABLE' | 'SERVICE_UNAVAILABLE' | 'NOT_CALLED'>;
  interrupts: { id: string; value: Record<string, unknown> }[];
  result: {
    status: string; company_id: string | null; reporting_year: number | null;
    intake_result: IntakeResult; objective: Objective; readiness: Record<string, Readiness>;
    recommendation: { selected_pathway_id: string | null; summary: string; reasons: string[] } | null;
    llm_explanation: { summary: string; trade_offs: string[]; risks: string[]; missing_data: string[] } | null;
    ranked_pathways: { rank: number; feasible: boolean; pathway: Pathway;
      constraints: { status: string; checks: { name: string; status: string; reason: string }[] };
      financing: { post_financing_dscr: number | null; annual_debt_service: number } | null; reasons: string[] }[];
    tool_results: Record<string, { data: Record<string, unknown> | null; missing_context: string[] }>;
    missing_context: string[]; warnings: string[]; errors: string[];
    execution_trace: { event: string; detail: string; tool: string | null; pathway_id: string | null; at: string }[];
    human_decision: { action: string; actor: string; reason: string } | null;
    human_history: Record<string, unknown>[];
  };
}
export type AgentAction = 'RESUME' | 'CANCEL' | 'ACCEPT' | 'REJECT' | 'REQUEST_ALTERNATIVE';
type IntakeReference = Pick<IntakeSession, 'intake_id' | 'access_token'>;
const base = (import.meta.env?.VITE_INTAKE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const key = 'greenbridge_main_agent_run';
export function rememberRun(run: AgentRun) { sessionStorage.setItem(key, JSON.stringify({ run_id: run.run_id, intake_id: run.intake_id })); }
export function savedRun(intakeId: string): string | null {
  try { const value = JSON.parse(sessionStorage.getItem(key) || 'null'); return value?.intake_id === intakeId && typeof value.run_id === 'string' ? value.run_id : null; }
  catch { return null; }
}
async function request(path: string, intake: IntakeReference, body?: unknown): Promise<AgentRun> {
  try {
    return await apiRequest<AgentRun>(`${base}/api/agent${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${intake.access_token}` }, body, timeoutMs: 120000 });
  } catch (error) {
    const detail = (error as { details?: { detail?: unknown } }).details?.detail;
    if (typeof detail === 'string') throw new Error(detail);
    if (Array.isArray(detail)) throw new Error('Check the objective fields and review reason. The server rejected this request.');
    throw error;
  }
}
export function startAgent(intake: IntakeReference, objective: Objective) {
  return request('/start', intake, { intake_id: intake.intake_id, objective });
}
export function getAgent(intake: IntakeReference, runId: string) {
  return request(`/${encodeURIComponent(runId)}/result`, intake);
}
export function resumeAgent(intake: IntakeReference, run: AgentRun, action: AgentAction, reason: string, objective?: Objective) {
  return request(`/${encodeURIComponent(run.run_id)}/resume`, intake, { action, reason, revision: run.revision, ...(objective ? { objective } : {}) });
}
