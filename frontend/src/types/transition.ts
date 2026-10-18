// TransitionAI — Types for SME Green Finance & Decarbonisation Copilot

export type UserRole = 'sme_owner' | 'finance_manager' | 'lender';

export type UploadContext = 'full_business_data' | 'energy_emissions';

export type FileMajorCategory = 'financial' | 'energy_emissions' | 'operational';

export type ActivityCategory =
  | 'electricity'
  | 'fuel_diesel'
  | 'fuel_petrol'
  | 'fuel_gas'
  | 'fuel_lpg'
  | 'water'
  | 'refrigerant'
  | 'bank_transactions'
  | 'financial_revenue_opex'
  | 'accounts_payable_receivable'
  | 'financial_report'
  | 'production_volume'
  | 'equipment_record'
  | 'operating_hours';

export type EmissionScope = 'Scope 1' | 'Scope 2' | 'Not Applicable';

export type DataQualityType = 'measured' | 'invoice_derived' | 'estimated' | 'proxy';

export interface ActivityRecord {
  id: string;
  sourceFileId?: string;
  sourceFileName?: string;
  date: string; // YYYY-MM-DD or YYYY-MM
  category: ActivityCategory;
  scope: EmissionScope;
  description: string;
  quantity: number;
  unit: string; // kWh, L, m3, kg
  cost: number; // in SME currency
  emissionFactor: number; // kgCO2e per unit
  factorSource: string; // e.g., "DEFRA 2024", "IEA 2023", "Suruhanjaya Tenaga 2023"
  emissionsKgCO2e: number;
  emissionsTCO2e: number;
  dataQuality: DataQualityType;
  invoiceNumber?: string;
  vendorName?: string;
  notes?: string;
  createdAt: string;
  status?: 'uploaded' | 'processing' | 'review_required' | 'validation_failed' | 'approved' | 'rejected' | 'failed';
  validationIssues?: string[];
  originalValue?: number | null;
  normalizedValue?: number | null;
  sourceDocumentId?: string;
  extractionConfidence?: number | null;
}

export interface BankTransactionRecord {
  id: string;
  date: string;
  description: string;
  category: 'revenue' | 'utility_energy' | 'fuel' | 'operating_expense' | 'payroll' | 'debt_service' | 'tax' | 'other';
  amount: number; // positive for inflow, negative for outflow
  type: 'inflow' | 'outflow';
  sourceFileName?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  registrationNumber?: string;
  industry: string; // e.g. "Precision Metal Manufacturing", "Food & Beverage Processing", "Logistics & Warehousing", "Commercial Printing"
  currency: string; // MYR, USD, EUR, GBP, SGD
  reportingYear: number;
  facilityLocation: string; // e.g. "Peninsular Malaysia", "Selangor", "United Kingdom", "US East"
  gridRegion: string;
  facilityFloorAreaSqM: number;
  employeeCount: number;
  annualRevenue: number;
  annualOperatingExpenses: number;
  cashBalance: number;
  existingAnnualDebtService: number;
  emissionReductionTargetPct: number; // e.g. 35% reduction by 2030
  targetYear: number;
  maxCapExBudget: number;
  minDscrRequirement: number; // default 1.25x
  isConfigured: boolean;
  lastUpdated?: string;
}

export interface EmissionFactorReference {
  category: ActivityCategory;
  name: string;
  scope: EmissionScope;
  unit: string;
  factorKgCO2e: number;
  source: string;
  region: string;
  effectiveYear: number;
  notes: string;
}

export interface CarbonBaselineSummary {
  reportingPeriod: string;
  scope1TCO2e: number;
  scope2TCO2e: number;
  totalTCO2e: number;
  emissionsByFuel: {
    category: ActivityCategory;
    name: string;
    scope: EmissionScope;
    quantity: number;
    unit: string;
    emissionsTCO2e: number;
    percentage: number;
    cost: number;
  }[];
  monthlyTrends: {
    month: string;
    scope1TCO2e: number;
    scope2TCO2e: number;
    totalTCO2e: number;
    energyCost: number;
  }[];
  intensityMetrics: {
    tco2ePerMillionRevenue: number;
    tco2ePerEmployee: number;
    kgco2ePerSqMFloorArea: number;
  };
  dataConfidence: {
    overallScorePct: number; // 0 - 100
    level: 'High' | 'Medium' | 'Low';
    measuredPct: number;
    invoiceDerivedPct: number;
    estimatedPct: number;
    proxyPct: number;
    totalRecords: number;
    missingPeriods: string[];
    recommendations: string[];
  };
}

export interface FinancialSummary {
  cashBalance: number;
  annualRevenue: number;
  annualOpEx: number;
  annualEnergyCost: number;
  annualFuelCost: number;
  totalUtilityCost: number;
  energyCostPctOfOpEx: number;
  ebitda: number;
  operatingCashFlow: number;
  existingDebtService: number;
  currentDscr: number;
  maxBorrowingCapacityAtTargetDscr: number;
  isSufficientData: boolean;
  dataCompletenessNotes: string[];
}

export interface FinancingSimulationParams {
  loanAmount: number;
  interestRatePct: number; // e.g. 3.75 for Green Loan vs 6.50 commercial
  tenureYears: number; // e.g. 5 or 7 years
  subsidyGrantPct?: number; // e.g. 10% green incentive
  annualOpExSavings: number; // savings from energy reduction
}

export interface FinancingSimulationResult {
  loanPrincipal: number;
  grantSubsidyAmount: number;
  equityContributionRequired: number;
  monthlyRepayment: number;
  annualRepayment: number;
  totalInterestPaid: number;
  annualSavings: number;
  netAnnualCashFlowImpact: number; // annualSavings - annualRepayment
  netMonthlyCashFlowImpact: number;
  simplePaybackYears: number;
  postInterventionDscr: number;
  isCashFlowPositive: boolean;
  cumulative10YearCashBenefit: number;
}

export interface DecarbonisationAction {
  id: string;
  title: string;
  category: 'Renewable Energy' | 'Energy Efficiency' | 'Electrification' | 'Process Optimization';
  description: string;
  scopeTarget: EmissionScope;
  capex: number; // upfront cost
  annualEnergySavingsUnit: string; // e.g., "kWh/year", "liters diesel/year"
  annualEnergySavingsQuantity: number;
  annualOpExSavings: number; // currency saved per year
  annualCO2eReductionTons: number; // tCO2e abated
  co2ReductionPct: number; // % of baseline
  paybackPeriodYears: number;
  tenYearNpv: number;
  roiPct: number;
  marginalAbatementCost: number; // cost per tCO2e abated ($ or RM / tCO2e)
  feasibilityScore: number; // 0-100
  recommendedPriority: 'High' | 'Medium' | 'Low';
  isSelectedForPlan: boolean;
  financing: FinancingSimulationResult;
  implementationTimeMonths: number;
  assumptions: string[];
  regulatoryStandards: string[];
}

export interface GreenLoanChecklistCriteria {
  id: string;
  category: string;
  requirement: string;
  status: 'passed' | 'conditional' | 'not_met';
  evidence: string;
  remediationAdvice?: string;
}

export interface GreenLoanEligibility {
  facilityName: string;
  sponsorInstitution: string; // e.g. "Bank Negara Malaysia (BNM)", "SBA Green 504", "EU Just Transition Fund"
  maxFacilitySize: number;
  concessionaryRatePct: number;
  commercialBenchmarkRatePct: number;
  overallStatus: 'Eligible' | 'Conditional' | 'Needs Additional Records';
  readinessScorePct: number;
  criteria: GreenLoanChecklistCriteria[];
}

export interface LenderPackage {
  id: string;
  packageName: string;
  companyName: string;
  createdDate: string;
  authorizedBy: string;
  authorizedRole: UserRole;
  sharingToken: string;
  isShared: boolean;
  sharedWithLenders: string[];
  expiresAt: string;
  disclosures: {
    includeExecutiveSummary: boolean;
    includeCarbonBaseline: boolean;
    includeFinancialSummary: boolean;
    includeDecarbonisationPlan: boolean;
    includeCashFlowProjections: boolean;
    includeEvidenceDocuments: boolean;
  };
  lenderRiskAssessment: {
    overallRisk: 'Low' | 'Moderate' | 'High';
    creditReadinessScore: number; // 0-100
    dscrStressTestPassed: boolean;
    carbonVerificationStatus: 'Verified by Audit Trail' | 'Self-Declared with Invoices' | 'Unverified';
    lenderKeyStrengths: string[];
    lenderKeyRisks: string[];
  };
  executiveSummaryText: string;
  auditEvidenceFiles: {
    fileName: string;
    fileType: string;
    recordsCount: number;
    uploadDate: string;
  }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userRole: UserRole;
  action: string;
  details: string;
  category: 'DATA_INGESTION' | 'CALCULATION' | 'PLAN_AUTHORIZATION' | 'LENDER_DISCLOSURE' | 'SIMULATION';
  evidenceRef?: string;
}

export interface OcrExtractedDocument {
  documentType: string;
  provider: string;
  accountOrInvoiceNo: string;
  billingPeriodOrDate: string;
  category: ActivityCategory;
  scope: EmissionScope;
  quantity: number;
  unit: string;
  totalCost: number;
  currency: string;
  confidenceScore: number;
  evidenceTextSnippet: string;
  calculatedEmissionsKgCO2e?: number;
  calculatedEmissionsTCO2e?: number;
  tariffDetails?: string;
  lineItems?: {
    description: string;
    quantity: number;
    unit: string;
    cost: number;
    date: string;
  }[];
}

export interface UploadedFileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  detectedCategory: ActivityCategory | 'bank_transactions' | 'mixed' | 'financial_statements';
  recordsImported: number;
  recordsSkipped: number;
  recordsFlagged: number;
  uploadTimestamp: string;
  status: 'uploaded' | 'processing' | 'review_required' | 'validation_failed' | 'approved' | 'rejected' | 'failed' | 'preview' | 'imported';
  isOcrParsed?: boolean;
  ocrDocument?: OcrExtractedDocument;
  errors?: string[];
  sourceCategory?: string;
  reportingPeriod?: string;
}

export interface StoredFinancialModel {
  isConfigured: boolean;
  sourceFileName?: string;
  reportingPeriod: string;
  currency: string;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  priorBalanceSheet?: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
  ratios: FinancialRatios;
  cashBudget?: {
    monthlySales: number[];
    monthlyPurchases: number[];
    monthlyOpEx: number[];
    monthLabels: string[];
  };
  lastUpdated: string;
}

export interface WorkspaceStatus {
  workspaceId: string;
  companyName: string;
  reportingPeriod: string;
  currency: string;
  totalSourceFiles: number;
  totalActivityRecords: number;
  totalTransactions: number;
  hasFinancialStatements: boolean;
  hasCarbonBaseline: boolean;
  hasDecarbonisationPlan: boolean;
  isLenderPackReady: boolean;
  lastDataUpdate: string;
  lastCalculation: string;
}

export interface InspectedUploadedFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  detectedCategory: ActivityCategory | 'bank_transactions' | 'mixed' | 'financial_statements';
  headers: string[];
  sampleRows: any[];
  totalSampleCount: number;
  suggestedMapping: Record<string, string>;
  isOcrParsed?: boolean;
  ocrDocument?: OcrExtractedDocument;
  sheets?: {
    name: string;
    type: 'income_statement' | 'balance_sheet' | 'cash_budget' | 'electricity' | 'fuel' | 'transactions' | 'other';
    headers: string[];
    rowsCount: number;
    sampleRows: any[];
  }[];
  extractedFinancialModel?: StoredFinancialModel;
}

// Complete 7-Sheet Financial Statement Models
export interface IncomeStatement {
  period: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  ebitda: number;
  depreciationAmortisation: number;
  ebit: number;
  financeCosts: number;
  profitBeforeTax: number;
  incomeTaxExpense: number;
  netProfit: number;
}

export interface BalanceSheet {
  period: string;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  otherCurrentAssets: number;
  currentAssets: number;
  fixedAssetsAtCost: number;
  accumulatedDepreciation: number;
  netFixedAssets: number;
  otherAssets: number;
  totalAssets: number;
  accountsPayable: number;
  shortTermDebt: number;
  otherCurrentLiabilities: number;
  currentLiabilities: number;
  longTermDebt: number;
  otherLiabilities: number;
  totalLiabilities: number;
  capital: number;
  retainedEarnings: number;
  ownerDrawings: number;
  otherEquity: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  reconciliationDifference: number; // totalAssets - totalLiabilitiesAndEquity
  isReconciled: boolean;
}

export interface CashFlowStatement {
  period: string;
  openingCash: number;
  netProfit: number;
  depreciationAddBack: number;
  deltaAccountsReceivable: number; // prior - current (increase reduces cash)
  deltaInventory: number; // prior - current (increase reduces cash)
  deltaAccountsPayable: number; // current - prior (increase provides cash)
  otherOperatingAdjustments: number;
  operatingCashFlow: number;
  capitalExpenditure: number; // stored as negative outflow
  assetDisposals: number;
  investingCashFlow: number;
  newBorrowing: number;
  principalRepayments: number; // stored as negative outflow
  equityContributions: number;
  drawings: number; // stored as negative outflow
  financingCashFlow: number;
  netChangeInCash: number;
  closingCash: number;
  balanceSheetCash: number;
  cashReconciliationDifference: number;
  isReconciled: boolean;
}

export interface RatioValue {
  value: number | null;
  formatted: string;
  isCalculable: boolean;
  status: 'healthy' | 'caution' | 'warning' | 'neutral' | 'not_calculable';
  explanation: string;
  formula: string;
}

export interface FinancialRatios {
  period: string;
  // Liquidity Ratios
  currentRatio: RatioValue;
  quickRatio: RatioValue;
  cashRatio: RatioValue;
  workingCapital: { value: number; formatted: string };
  // Leverage Ratios
  debtToEquityTotal: RatioValue;
  debtToEquityInterestBearing: RatioValue;
  debtRatio: RatioValue;
  interestCoverage: RatioValue;
  equityMultiplier: RatioValue;
  // Profitability Ratios
  grossProfitMargin: RatioValue;
  netProfitMargin: RatioValue;
  ebitdaMargin: RatioValue;
  returnOnAssets: RatioValue;
  returnOnEquity: RatioValue;
  // Efficiency Ratios
  daysSalesOutstanding: RatioValue; // DSO
  daysInventoryOutstanding: RatioValue; // DIO
  daysPayableOutstanding: RatioValue; // DPO
  cashConversionCycle: RatioValue; // CCC
  assetTurnover: RatioValue;
  inventoryTurnover: RatioValue;
}

export interface CashBudgetCollectionSchedule {
  currentMonthPct: number; // e.g. 50
  oneMonthLaterPct: number; // e.g. 30
  twoMonthsLaterPct: number; // e.g. 20
}

export interface CashBudgetMonth {
  monthIndex: number; // 1 to 12
  monthLabel: string; // e.g. "Month 1", "Jan 2025"
  openingCash: number;
  cashSales: number;
  collectionsMonth0: number;
  collectionsMonth1: number;
  collectionsMonth2: number;
  totalCollections: number;
  otherReceipts: number;
  totalCashReceipts: number;
  cashPurchases: number;
  supplierPayments: number;
  operatingExpensesPaid: number;
  taxPayments: number;
  interestPayments: number;
  principalRepayments: number;
  capitalExpenditure: number;
  totalCashDisbursements: number;
  newBorrowing: number;
  netChangeInCash: number;
  closingCash: number;
  minimumCashBuffer: number;
  shortfall: number; // Math.max(0, minimumCashBuffer - closingCash)
  hasShortfall: boolean;
}

export interface CashShortfallAlert {
  firstShortfallMonth: string;
  monthIndex: number;
  expectedClosingCash: number;
  minimumBuffer: number;
  shortfallAmount: number;
  durationMonths: number;
  fundingNeededToRestoreBuffer: number;
  primaryDrivers: string[];
  recommendedActions: {
    action: string;
    expectedCashImpact: number;
    feasibility: 'High' | 'Medium' | 'Low';
    timeframe: string;
  }[];
  dataConfidenceStatus: 'High' | 'Medium' | 'Low';
}

export interface TaxAdjustmentWorkflow {
  taxYear: number;
  jurisdiction: string; // "Malaysia (IRB/LHDN)"
  entityType: 'SME Company (Sdn Bhd)' | 'Sole Proprietorship' | 'Partnership';
  accountingProfit: number;
  nonDeductibleExpenses: number;
  exemptIncome: number;
  adjustedBusinessIncome: number;
  capitalAllowances: number;
  lossesCarriedForward: number;
  chargeableIncome: number;
  tier1RatePct: number; // 15% on first 150k
  tier2RatePct: number; // 17% on 150k-600k
  tier3RatePct: number; // 24% on >600k
  calculatedTaxExpense: number;
  effectiveTaxRatePct: number;
  taxInstallmentsPaid: number;
  estimatedBalanceTaxPayable: number;
  notes: string[];
}

export interface FinancialTestSuiteResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  description: string;
  details?: string;
}

export type TransitionTab =
  | 'overview'
  | 'ingestion'
  | 'baseline'
  | 'financials'
  | 'actions'
  | 'transition-plan'
  | 'copilot'
  | 'audit'
  | 'test-suite'
  | 'legal-governance';

