import { CarbonBaselineSummary, FinancialSummary, DecarbonisationAction, LenderPackage } from '../types/transition';
export interface ApprovedPack {
  packageInfo: Pick<LenderPackage, 'id' | 'packageName' | 'companyName' | 'createdDate' | 'authorizedBy' | 'expiresAt' | 'disclosures'>;
  executiveSummary: string | null;
  carbonBaseline: Partial<CarbonBaselineSummary> | null;
  financialSummary: Partial<FinancialSummary> | null;
  decarbonisationPlan: DecarbonisationAction[] | null;
  evidenceFiles: LenderPackage['auditEvidenceFiles'] | null;
}
export async function loadApprovedPack(token: string, signal?: AbortSignal): Promise<ApprovedPack> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(token)) throw new Error('Enter a valid sharing token supplied by the SME Owner.');
  const response = await fetch(`/api/transition/lender-package/${encodeURIComponent(token)}`, { signal });
  if (!response.ok) throw new Error('Approved pack unavailable. Check the sharing token with the SME.');
  const raw = await response.json();
  const info = raw.packageInfo;
  const expiry = Date.parse(info?.expiresAt);
  if (!info?.id || !info.authorizedBy || !info.disclosures || !Number.isFinite(expiry) || expiry < new Date().setUTCHours(0, 0, 0, 0) || info.isShared === false) throw new Error('This pack has no valid disclosure authorization or has expired.');
  // Whitelist sections again locally; never render the internal state endpoint or
  // extra server fields (including an undisclosed eligibility assessment).
  const disclosures = info.disclosures;
  return {
    packageInfo: { id: info.id, packageName: info.packageName, companyName: info.companyName, createdDate: info.createdDate, authorizedBy: info.authorizedBy, expiresAt: info.expiresAt, disclosures },
    executiveSummary: disclosures.includeExecutiveSummary ? raw.executiveSummary ?? null : null,
    carbonBaseline: disclosures.includeCarbonBaseline ? raw.carbonBaseline ?? null : null,
    financialSummary: disclosures.includeFinancialSummary ? raw.financialSummary ?? null : null,
    decarbonisationPlan: disclosures.includeDecarbonisationPlan ? raw.decarbonisationPlan ?? null : null,
    evidenceFiles: disclosures.includeEvidenceDocuments ? raw.evidenceFiles ?? null : null,
  };
}
