import { Bill, BusinessProfile, Invoice, AuditLogEntry } from '../types/finance';

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  id: '',
  name: '',
  registrationNumber: '',
  industry: '',
  currency: 'MYR',
  initialCashSen: 0,
  minReserveSen: 0,
  forecastHorizonDays: 30,
  bankName: '',
  accountNumberMasked: '',
  isConfigured: false
};

export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_BILLS: Bill[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

// Clean downloadable reference templates for user convenience
export const SAMPLE_INVOICES_TEMPLATE_CSV = `Invoice_ID,Customer_Name,Contact_Email,Amount_MYR,Issue_Date,Due_Date,Status
INV-001,Customer Alpha,accounts@alpha.my,8500.00,2026-10-01,2026-10-20,Unpaid
INV-002,Client Beta,finance@beta.my,14200.00,2026-09-25,2026-10-12,Overdue
`;

export const SAMPLE_BILLS_TEMPLATE_CSV = `Bill_ID,Vendor_Name,Category,Amount_MYR,Due_Date,Due_Day_Offset,Status
BILL-101,Office Management,Rent,9000.00,2026-10-25,10,Unpaid
BILL-102,Cloud Server Provider,IT Infrastructure,4500.00,2026-10-28,13,Unpaid
`;

export const SAMPLE_BANK_TEMPLATE_CSV = `Date,Description,Reference,Type,Amount_MYR
2026-10-10,Customer Settlement,DEP-001,Credit,12000.00
2026-10-12,Vendor Payment,PAY-002,Debit,4500.00
`;
