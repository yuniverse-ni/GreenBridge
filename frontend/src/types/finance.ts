export type CurrencyCode = string;

export interface BusinessProfile {
  id: string;
  name: string;
  registrationNumber?: string;
  industry?: string;
  currency: CurrencyCode;
  initialCashSen: number;   // Stored in integer sen (e.g., 1800000 = RM 18,000.00)
  minReserveSen: number;     // e.g., 500000 = RM 5,000.00
  forecastHorizonDays: number; // 7, 14, 30, 90
  bankName?: string;
  accountNumberMasked?: string;
  isConfigured: boolean;
  lastUpdated?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid' | 'disputed';
export type BillStatus = 'unpaid' | 'scheduled' | 'negotiating' | 'deferred' | 'paid';

export interface Invoice {
  id: string;
  customerName: string;
  customerContact?: string;
  customerEmail?: string;
  amountSen: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  daysOverdue: number;
  status: InvoiceStatus;
  category?: string;
  description: string;
  sourceFileName?: string;
  confidenceScore?: number;
  simulatedPaidDate?: string;
}

export interface Bill {
  id: string;
  vendorName: string;
  vendorContact?: string;
  amountSen: number;
  dueDate: string;   // YYYY-MM-DD
  dueDayOffset: number; // days offset from today
  status: BillStatus;
  category?: string;
  description: string;
  canNegotiate: boolean;
  sourceFileName?: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  reference?: string;
  type: 'Credit' | 'Debit';
  amountSen: number;
  runningBalanceSen?: number;
  sourceFileName?: string;
}

export interface CashProjectionPoint {
  dayIndex: number;
  dateString: string;
  rawDate: string;
  openingBalanceSen: number;
  projectedInflowsSen: number;
  projectedOutflowsSen: number;
  closingBalanceSen: number;
  minReserveSen: number;
  isBreach: boolean;
  breachAmountSen: number;
  inflowDetails: { description: string; amountSen: number; confirmed: boolean; recordId?: string }[];
  outflowDetails: { description: string; amountSen: number; recordId?: string }[];
}

export interface CashAlert {
  id: string;
  severity: 'critical' | 'warning' | 'healthy' | 'insufficient_data';
  title: string;
  breachDayIndex: number;
  breachDate: string;
  lowestBalanceSen: number;
  reserveDeficitSen: number;
  shortDescription: string;
  rootCause: string;
  recommendedActionSummary: string;
  contributingBills?: Bill[];
  contributingInvoices?: Invoice[];
}

export type PlanId = 'PLAN_A' | 'PLAN_B' | 'PLAN_C' | 'CUSTOM';

export interface ScenarioPlan {
  id: PlanId;
  code: string;
  name: string;
  strategySummary: string;
  lowestBalanceSen: number;
  lowestBalanceDay: number;
  reserveBreachSen: number;
  financialImpactSen: number;
  operationalRisk: 'Low' | 'Medium' | 'High';
  assumptions: string[];
  recommended: boolean;
  whyRecommended?: string;
  actions: ProposedAction[];
  targetCollectionDayOffset?: number;
  supplierExtensionDays?: number;
  discretionaryCutSen?: number;
}

export type ActionStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Executed' | 'Failed' | 'Rejected';

export interface ProposedAction {
  id: string;
  title: string;
  purpose: string;
  targetEntity: string;
  referenceId: string;
  amountSen: number;
  recipientContact?: string;
  recipientEmail?: string;
  expectedEffect: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  requiresHumanApproval: boolean;
  status: ActionStatus;
  preparedDate: string;
  approvedDate?: string;
  executedDate?: string;
  rejectionReason?: string;
  draftMessageSubject?: string;
  draftMessageBody?: string;
  executionReceipt?: {
    channel: string;
    dispatchId: string;
    sentAt: string;
    verified: boolean;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  stepNumber: number;
  stage: string;
  summary: string;
  detail: string;
  actor: string;
  statusBadge: 'completed' | 'pending' | 'flagged';
  dataSnapshot?: Record<string, any>;
}

export interface UploadedFileRecord {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  recordCount: number;
  category: 'invoices' | 'bills' | 'transactions' | 'mixed';
}

export interface ColumnMappingConfig {
  idColumn: string;
  entityColumn: string;
  amountColumn: string;
  dateColumn: string;
  dueDateColumn?: string;
  typeColumn?: string;
  categoryColumn?: string;
  statusColumn?: string;
}

export interface UploadPreviewBatch {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  detectedCategory: 'invoices' | 'bills' | 'transactions' | 'mixed';
  headers: string[];
  rawRows: Record<string, any>[];
  suggestedMapping: ColumnMappingConfig;
  totalRows: number;
  errors?: { rowIndex: number; issue: string; rawRow: Record<string, any> }[];
}

export interface CopilotChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citedRecords?: {
    type: 'invoice' | 'bill' | 'transaction' | 'balance';
    id: string;
    name: string;
    amountSen: number;
    date: string;
  }[];
}
