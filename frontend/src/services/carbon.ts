import { useEffect, useState } from 'react';
import { apiRequest } from './api';
import { IntakeSession, Readiness, ValueEvidence, savedIntake } from './intake';

export interface CarbonSource {
  scope: 'Scope 1' | 'Scope 2'; activity_value: number | null; activity_unit: string;
  factor: number; factor_unit: string; factor_source: string; factor_version: string; factor_region: string;
  emissions: number | null; emissions_unit: 'tCO2e'; share_pct: number | null;
}
export interface CarbonResult {
  company_id: string; reporting_year: number; source: string; origin: 'SERVICE';
  scope1_emissions: number | null; scope2_emissions: number | null; total_emissions: number | null;
  total_tco2e: number | null; known_emissions: number; emissions_unit: 'tCO2e';
  emissions_by_source: Record<string, CarbonSource>;
  carbon_intensity: { value: number | null; unit: 'kgCO2e/m2'; floor_area_m2: number | null; reason: string | null };
  provenance: Record<string, unknown[]>; evidence: ValueEvidence[];
  confidence: { externally_verified: false; evidence_quality_counts: Record<string, number>;
    extraction_confidence: (number | null)[]; mapping_confidence: (number | null)[]; description: string };
  missing_data: string[]; warnings: string[]; readiness: Readiness;
  assumptions: string[]; evidence_limitations: string[];
}
export interface CarbonResponse { data: CarbonResult | null; missing_context: string[] }
const base = (import.meta.env?.VITE_INTAKE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export async function getCarbon(intake: Pick<IntakeSession, 'intake_id' | 'access_token'>): Promise<CarbonResponse> {
  try {
    return await apiRequest<CarbonResponse>(`${base}/api/carbon/intakes/${encodeURIComponent(intake.intake_id)}/result`, {
      headers: { Authorization: `Bearer ${intake.access_token}` }, timeoutMs: 120000,
    });
  } catch (error) {
    const detail = (error as { details?: { detail?: unknown } }).details?.detail;
    if (typeof detail === 'string') throw new Error(detail);
    throw error;
  }
}

export function useCarbonAnalysis() {
  const [result, setResult] = useState<CarbonResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const intake = savedIntake();
    setResult(null); setMessage(null);
    if (!intake) { setBusy(false); setMessage('Upload and analyse your data in Data & Documents to see Carbon analysis.'); return; }
    setBusy(true);
    getCarbon(intake).then(response => {
      if (!active) return;
      setResult(response.data);
      if (!response.data) setMessage('Carbon analysis is not available yet. Review your activity records in Data & Documents.');
    }).catch(() => { if (active) setMessage('We could not load Carbon analysis. Try again or review your uploaded data.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [revision]);
  return { result, message, busy, refresh: () => setRevision(value => value + 1) };
}

export const carbonNumber = (value: number | null | undefined) => value == null ? 'Not available'
  : new Intl.NumberFormat('en-MY', { maximumFractionDigits: 6 }).format(value);
