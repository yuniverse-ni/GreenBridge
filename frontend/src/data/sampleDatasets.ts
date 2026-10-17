// Sample Realistic Datasets for SME Transition & Green Finance Testing
// Provides realistic utility bills, fuel purchases, and financial transactions
// for a precision engineering SME and a food packaging SME.

import { ActivityRecord, BankTransactionRecord, BusinessProfile } from '../types/transition';

export const SAMPLE_SME_PROFILE: BusinessProfile = {
  id: 'SME-APEX-01',
  name: 'Apex Precision Engineering Sdn Bhd',
  registrationNumber: '201801029481 (1289502-K)',
  industry: 'Precision Metal & Tooling Manufacturing',
  currency: 'MYR',
  reportingYear: 2024,
  facilityLocation: 'Shah Alam Industrial Park, Selangor',
  gridRegion: 'Peninsular Malaysia',
  facilityFloorAreaSqM: 4200,
  employeeCount: 48,
  annualRevenue: 4850000, // RM 4.85 Million
  annualOperatingExpenses: 3950000, // RM 3.95 Million
  cashBalance: 420000,
  existingAnnualDebtService: 120000, // RM 10k/month equipment financing
  emissionReductionTargetPct: 35, // 35% reduction target by 2030
  targetYear: 2030,
  maxCapExBudget: 600000,
  minDscrRequirement: 1.25,
  isConfigured: true,
  lastUpdated: new Date().toISOString()
};

export const SAMPLE_ACTIVITY_RECORDS: ActivityRecord[] = [
  // 12 Months of Electricity Utility Bills (TNB Tariff E1 Medium Voltage General Commercial/Industrial)
  {
    id: 'REC-ELEC-2024-01',
    sourceFileName: 'TNB_Electricity_Bill_Jan2024.pdf',
    date: '2024-01-31',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101 - Peak & Off-Peak Metered',
    quantity: 18450,
    unit: 'kWh',
    cost: 9410.50,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 10774.8,
    emissionsTCO2e: 10.77,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'TNB-2024-01-4491',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-02-05T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-02',
    sourceFileName: 'TNB_Electricity_Bill_Feb2024.pdf',
    date: '2024-02-29',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 17200,
    unit: 'kWh',
    cost: 8772.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 10044.8,
    emissionsTCO2e: 10.04,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'TNB-2024-02-8821',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-03-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-03',
    sourceFileName: 'TNB_Electricity_Bill_Mar2024.pdf',
    date: '2024-03-31',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - High factory CNC cycle',
    quantity: 19800,
    unit: 'kWh',
    cost: 10098.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 11563.2,
    emissionsTCO2e: 11.56,
    dataQuality: 'measured',
    invoiceNumber: 'TNB-2024-03-1294',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-04-03T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-04',
    sourceFileName: 'TNB_Electricity_Bill_Apr2024.pdf',
    date: '2024-04-30',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 18100,
    unit: 'kWh',
    cost: 9231.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 10570.4,
    emissionsTCO2e: 10.57,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'TNB-2024-04-9042',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-05-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-05',
    sourceFileName: 'TNB_Electricity_Bill_May2024.pdf',
    date: '2024-05-31',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 19150,
    unit: 'kWh',
    cost: 9766.50,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 11183.6,
    emissionsTCO2e: 11.18,
    dataQuality: 'measured',
    invoiceNumber: 'TNB-2024-05-3810',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-06-03T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-06',
    sourceFileName: 'TNB_Electricity_Bill_Jun2024.pdf',
    date: '2024-06-30',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 18900,
    unit: 'kWh',
    cost: 9639.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 11037.6,
    emissionsTCO2e: 11.04,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'TNB-2024-06-7281',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-07-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-07',
    sourceFileName: 'TNB_Electricity_Bill_Jul2024.pdf',
    date: '2024-07-31',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 20200,
    unit: 'kWh',
    cost: 10302.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 11796.8,
    emissionsTCO2e: 11.80,
    dataQuality: 'measured',
    invoiceNumber: 'TNB-2024-07-4921',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-08-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-08',
    sourceFileName: 'TNB_Electricity_Bill_Aug2024.pdf',
    date: '2024-08-31',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 19400,
    unit: 'kWh',
    cost: 9894.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 11329.6,
    emissionsTCO2e: 11.33,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'TNB-2024-08-1123',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-09-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-09',
    sourceFileName: 'TNB_Electricity_Bill_Sep2024.pdf',
    date: '2024-09-30',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 18600,
    unit: 'kWh',
    cost: 9486.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 10862.4,
    emissionsTCO2e: 10.86,
    dataQuality: 'measured',
    invoiceNumber: 'TNB-2024-09-6612',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-10-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-10',
    sourceFileName: 'TNB_Electricity_Bill_Oct2024.pdf',
    date: '2024-10-31',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 19700,
    unit: 'kWh',
    cost: 10047.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 11504.8,
    emissionsTCO2e: 11.50,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'TNB-2024-10-8809',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-11-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-11',
    sourceFileName: 'TNB_Electricity_Bill_Nov2024.pdf',
    date: '2024-11-30',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 18250,
    unit: 'kWh',
    cost: 9307.50,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 10658.0,
    emissionsTCO2e: 10.66,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'TNB-2024-11-3310',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2024-12-04T08:00:00Z'
  },
  {
    id: 'REC-ELEC-2024-12',
    sourceFileName: 'TNB_Electricity_Bill_Dec2024.pdf',
    date: '2024-12-31',
    category: 'electricity',
    scope: 'Scope 2',
    description: 'TNB Electricity Invoice - Account #220194829101',
    quantity: 19100,
    unit: 'kWh',
    cost: 9741.00,
    emissionFactor: 0.584,
    factorSource: 'Suruhanjaya Tenaga Grid Emission Factor 2023',
    emissionsKgCO2e: 11154.4,
    emissionsTCO2e: 11.15,
    dataQuality: 'measured',
    invoiceNumber: 'TNB-2024-12-5521',
    vendorName: 'Tenaga Nasional Berhad',
    createdAt: '2025-01-05T08:00:00Z'
  },

  // SCOPE 1: Commercial Fleet Diesel & Standby Generator Purchases (Petronas Fleet Card & Bulk Delivery)
  {
    id: 'REC-DIESEL-2024-Q1',
    sourceFileName: 'Petronas_Commercial_Fuel_Q1_2024.csv',
    date: '2024-03-31',
    category: 'fuel_diesel',
    scope: 'Scope 1',
    description: 'Petronas SmartPay Fleet Card - 3 Factory Delivery Vans & Forklifts',
    quantity: 4850,
    unit: 'L',
    cost: 10427.50,
    emissionFactor: 2.6865,
    factorSource: 'UK DEFRA / IPCC 2024 Fuel Conversion Factors',
    emissionsKgCO2e: 13029.5,
    emissionsTCO2e: 13.03,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'PDB-FP-2024-0391',
    vendorName: 'Petronas Dagangan Berhad',
    createdAt: '2024-04-02T10:00:00Z'
  },
  {
    id: 'REC-DIESEL-2024-Q2',
    sourceFileName: 'Petronas_Commercial_Fuel_Q2_2024.csv',
    date: '2024-06-30',
    category: 'fuel_diesel',
    scope: 'Scope 1',
    description: 'Petronas SmartPay Fleet Card - Q2 Logistics Fuel',
    quantity: 5120,
    unit: 'L',
    cost: 11008.00,
    emissionFactor: 2.6865,
    factorSource: 'UK DEFRA / IPCC 2024 Fuel Conversion Factors',
    emissionsKgCO2e: 13754.9,
    emissionsTCO2e: 13.75,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'PDB-FP-2024-0718',
    vendorName: 'Petronas Dagangan Berhad',
    createdAt: '2024-07-02T10:00:00Z'
  },
  {
    id: 'REC-DIESEL-2024-Q3',
    sourceFileName: 'Petronas_Commercial_Fuel_Q3_2024.csv',
    date: '2024-09-30',
    category: 'fuel_diesel',
    scope: 'Scope 1',
    description: 'Petronas SmartPay Fleet Card - Q3 Fleet Logistics',
    quantity: 4980,
    unit: 'L',
    cost: 10707.00,
    emissionFactor: 2.6865,
    factorSource: 'UK DEFRA / IPCC 2024 Fuel Conversion Factors',
    emissionsKgCO2e: 13378.8,
    emissionsTCO2e: 13.38,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'PDB-FP-2024-1102',
    vendorName: 'Petronas Dagangan Berhad',
    createdAt: '2024-10-02T10:00:00Z'
  },
  {
    id: 'REC-DIESEL-2024-Q4',
    sourceFileName: 'Petronas_Commercial_Fuel_Q4_2024.csv',
    date: '2024-12-31',
    category: 'fuel_diesel',
    scope: 'Scope 1',
    description: 'Petronas SmartPay Fleet Card - Q4 Fleet Logistics & Generator Test Run',
    quantity: 5350,
    unit: 'L',
    cost: 11502.50,
    emissionFactor: 2.6865,
    factorSource: 'UK DEFRA / IPCC 2024 Fuel Conversion Factors',
    emissionsKgCO2e: 14372.8,
    emissionsTCO2e: 14.37,
    dataQuality: 'invoice_derived',
    invoiceNumber: 'PDB-FP-2024-1520',
    vendorName: 'Petronas Dagangan Berhad',
    createdAt: '2025-01-04T10:00:00Z'
  },

  // SCOPE 1: Industrial Natural Gas (Heat treatment oven)
  {
    id: 'REC-GAS-2024-ANNUAL',
    sourceFileName: 'Gas_Malaysia_Statement_2024.pdf',
    date: '2024-12-31',
    category: 'fuel_gas',
    scope: 'Scope 1',
    description: 'Gas Malaysia Industrial Pipeline Meter - Tempering & Annealing Oven',
    quantity: 14200,
    unit: 'm3',
    cost: 21300.00,
    emissionFactor: 2.0226,
    factorSource: 'DEFRA / Gas Malaysia Industrial Tariff 2024',
    emissionsKgCO2e: 28720.9,
    emissionsTCO2e: 28.72,
    dataQuality: 'measured',
    invoiceNumber: 'GM-2024-99120',
    vendorName: 'Gas Malaysia Energy Services',
    createdAt: '2025-01-10T09:00:00Z'
  }
];

export const SAMPLE_BANK_TRANSACTIONS: BankTransactionRecord[] = [
  {
    id: 'TX-2024-001',
    date: '2024-01-15',
    description: 'Customer Payment - Western Digital Aerospace Components',
    category: 'revenue',
    amount: 385000,
    type: 'inflow',
    sourceFileName: 'Maybank_Corporate_Statement_2024.csv'
  },
  {
    id: 'TX-2024-002',
    date: '2024-01-28',
    description: 'Tenaga Nasional Berhad Direct Debit - Electricity Bill',
    category: 'utility_energy',
    amount: -9410.50,
    type: 'outflow',
    sourceFileName: 'Maybank_Corporate_Statement_2024.csv'
  },
  {
    id: 'TX-2024-003',
    date: '2024-01-30',
    description: 'Factory Payroll & EPF/SOCSO - 48 Employees',
    category: 'payroll',
    amount: -185000,
    type: 'outflow',
    sourceFileName: 'Maybank_Corporate_Statement_2024.csv'
  },
  {
    id: 'TX-2024-004',
    date: '2024-02-15',
    description: 'Customer Inflow - Panasonic Industrial Precision Parts',
    category: 'revenue',
    amount: 412000,
    type: 'inflow',
    sourceFileName: 'Maybank_Corporate_Statement_2024.csv'
  },
  {
    id: 'TX-2024-005',
    date: '2024-02-28',
    description: 'Bank Equipment Financing Term Loan Repayment',
    category: 'debt_service',
    amount: -10000,
    type: 'outflow',
    sourceFileName: 'Maybank_Corporate_Statement_2024.csv'
  }
];

// Helper to generate downloadable CSV template string
export function generateSampleCsvContent(type: 'electricity' | 'fuel' | 'bank_transactions' | 'financial_statements' | 'cash_budget'): string {
  if (type === 'financial_statements') {
    return `Financial_Category,Line_Item,FY2023_MYR,FY2024_MYR,Notes
Income_Statement,Gross_Revenue,2900000,3200000,Operating sales receipts
Income_Statement,Cost_of_Goods_Sold,1740000,1920000,Raw materials & direct manufacturing costs
Income_Statement,Operating_Expenses,620000,680000,Factory overhead & administration
Income_Statement,Depreciation_Amortisation,90000,95000,Straight-line plant machinery depreciation
Income_Statement,Finance_Costs,38000,32000,Bank facility interest charges
Income_Statement,Income_Tax_Expense,72000,80500,LHDN Corporate tax
Balance_Sheet,Cash_and_Bank,240000,312500,Current bank account balances
Balance_Sheet,Accounts_Receivable,410000,460000,Trade customer debtor balances
Balance_Sheet,Inventory,280000,310000,Raw materials & finished tooling stock
Balance_Sheet,Other_Current_Assets,25000,25000,Deposits & prepayments
Balance_Sheet,Fixed_Assets_Cost,1100000,1220000,Machinery & equipment cost
Balance_Sheet,Accumulated_Depreciation,320000,415000,Cumulative depreciation reserve
Balance_Sheet,Accounts_Payable,215000,245000,Trade supplier balances
Balance_Sheet,Short_Term_Debt,65000,70000,Current portion of term loans
Balance_Sheet,Long_Term_Debt,320000,275000,Term loans & hire purchase principal
Balance_Sheet,Paid_Up_Capital,500000,500000,Ordinary equity shares
Balance_Sheet,Retained_Earnings,635000,927500,Cumulative earnings less dividends`;
  }

  if (type === 'cash_budget') {
    return `Month,Month_Label,Monthly_Sales,Cash_Sales_Pct,Purchases,OpEx_Paid,Tax_Paid,Interest_Paid,Principal_Repaid
1,Jan 2025,250000,20,145000,56000,0,2500,4500
2,Feb 2025,260000,20,150000,56000,0,2500,4500
3,Mar 2025,240000,20,139000,56000,20000,2500,4500
4,Apr 2025,270000,20,156000,56000,0,2500,4500
5,May 2025,280000,20,162000,56000,0,2500,4500
6,Jun 2025,290000,20,168000,56000,20000,2500,4500
7,Jul 2025,275000,20,159000,56000,0,2500,4500
8,Aug 2025,265000,20,153000,56000,0,2500,4500
9,Sep 2025,285000,20,165000,56000,20000,2500,4500
10,Oct 2025,300000,20,174000,56000,0,2500,4500
11,Nov 2025,310000,20,179000,56000,0,2500,4500
12,Dec 2025,320000,20,185000,56000,20500,2500,4500`;
  }

  if (type === 'electricity') {
    return `Date,InvoiceNumber,VendorName,MeterReading_kWh,Cost_MYR,DataQuality,Notes
2024-01-31,TNB-2024-01-4491,Tenaga Nasional Berhad,18450,9410.50,measured,January monthly factory electricity
2024-02-29,TNB-2024-02-8821,Tenaga Nasional Berhad,17200,8772.00,invoice_derived,February monthly factory electricity
2024-03-31,TNB-2024-03-1294,Tenaga Nasional Berhad,19800,10098.00,measured,March high production cycle
2024-04-30,TNB-2024-04-9042,Tenaga Nasional Berhad,18100,9231.00,invoice_derived,April regular production
2024-05-31,TNB-2024-05-3810,Tenaga Nasional Berhad,19150,9766.50,measured,May peak manufacturing
2024-06-30,TNB-2024-06-7281,Tenaga Nasional Berhad,18900,9639.00,invoice_derived,June electricity statement
2024-07-31,TNB-2024-07-4921,Tenaga Nasional Berhad,20200,10302.00,measured,July quarterly peak load
2024-08-31,TNB-2024-08-1123,Tenaga Nasional Berhad,19400,9894.00,invoice_derived,August electricity statement
2024-09-30,TNB-2024-09-6612,Tenaga Nasional Berhad,18600,9486.00,measured,September production
2024-10-31,TNB-2024-10-8809,Tenaga Nasional Berhad,19700,10047.00,invoice_derived,October factory run
2024-11-30,TNB-2024-11-3310,Tenaga Nasional Berhad,18250,9307.50,invoice_derived,November electricity
2024-12-31,TNB-2024-12-5521,Tenaga Nasional Berhad,19100,9741.00,measured,December year-end cycle`;
  }

  if (type === 'fuel') {
    return `Date,ReceiptNumber,FuelType,Volume_Liters,Cost_MYR,VehiclePlate_Or_Equipment,DataQuality
2024-01-31,PET-FP-0192,Diesel,1250,2687.50,Delivery Van BNA 8492,invoice_derived
2024-02-28,PET-FP-0481,Diesel,1180,2537.00,Delivery Van BNA 8492,invoice_derived
2024-03-31,PET-FP-0912,Diesel,1420,3053.00,Forklifts & Standby Generator,measured
2024-04-30,PET-FP-1382,Diesel,1310,2816.50,Delivery Van BWE 2210,invoice_derived
2024-05-31,PET-FP-1849,Diesel,1380,2967.00,Delivery Van BNA 8492,invoice_derived
2024-06-30,PET-FP-2311,Diesel,1430,3074.50,Delivery Van BWE 2210,invoice_derived
2024-07-31,PET-FP-2849,Diesel,1510,3246.50,Fleet Delivery & Logistics,invoice_derived
2024-08-31,PET-FP-3391,Diesel,1480,3182.00,Delivery Van BNA 8492,invoice_derived
2024-09-30,PET-FP-3920,Diesel,1420,3053.00,Delivery Van BWE 2210,invoice_derived
2024-10-31,PET-FP-4410,Diesel,1460,3139.00,Delivery Van BNA 8492,invoice_derived
2024-11-30,PET-FP-4982,Diesel,1390,2988.50,Forklifts & Logistics,invoice_derived
2024-12-31,PET-FP-5512,Diesel,1540,3311.00,Standby Gen-set Maintenance & Fleet,measured`;
  }

  return `Date,TransactionID,Description,Category,Amount,Type
2024-01-15,TX-01,Western Digital Inflow,revenue,385000,inflow
2024-01-28,TX-02,TNB Electricity Bill Payment,utility_energy,-9410.50,outflow
2024-01-30,TX-03,Factory Payroll,payroll,-185000,outflow
2024-02-15,TX-04,Panasonic Industrial Payment,revenue,412000,inflow
2024-02-28,TX-05,Bank Loan Repayment,debt_service,-10000,outflow`;
}
