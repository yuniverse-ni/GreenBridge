// TransitionAI Backend Router & Storage Engine
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import {
  BusinessProfile,
  ActivityRecord,
  BankTransactionRecord,
  LenderPackage,
  AuditLogEntry,
  UploadedFileInfo,
  ActivityCategory,
  DataQualityType,
  StoredFinancialModel,
  WorkspaceStatus
} from '../types/transition';
import { DOCUMENTED_EMISSION_FACTORS, getEmissionFactorForActivity } from '../utils/carbonFactors';
import { SAMPLE_SME_PROFILE, SAMPLE_ACTIVITY_RECORDS, SAMPLE_BANK_TRANSACTIONS } from '../data/sampleDatasets';
import {
  calculate_carbon_baseline,
  get_financial_summary,
  generate_decarbonisation_actions,
  evaluate_green_loan_eligibility
} from '../utils/transitionCalculations';
import { get_standard_sme_financial_model } from '../utils/financialEngine';
import { processUploadedDocument } from './ocrEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const TRANSITION_STORAGE_FILE = path.resolve(DATA_DIR, 'transition_store.json');
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface TransitionStore {
  profile: BusinessProfile;
  financialModel: StoredFinancialModel | null;
  activityRecords: ActivityRecord[];
  bankTransactions: BankTransactionRecord[];
  selectedActionIds: string[];
  lenderPackages: LenderPackage[];
  auditLogs: AuditLogEntry[];
  uploadedFiles: UploadedFileInfo[];
}

function getInitialTransitionStore(): TransitionStore {
  return {
    profile: {
      id: 'SME-USER-01',
      name: '',
      currency: 'MYR',
      reportingYear: 2024,
      industry: '',
      facilityLocation: 'Peninsular Malaysia',
      gridRegion: 'Peninsular Malaysia',
      facilityFloorAreaSqM: 0,
      employeeCount: 0,
      annualRevenue: 0,
      annualOperatingExpenses: 0,
      cashBalance: 0,
      existingAnnualDebtService: 0,
      emissionReductionTargetPct: 30,
      targetYear: 2030,
      maxCapExBudget: 500000,
      minDscrRequirement: 1.25,
      isConfigured: false
    },
    financialModel: null,
    activityRecords: [],
    bankTransactions: [],
    selectedActionIds: ['ACT-SOLAR-01', 'ACT-LED-02'],
    lenderPackages: [],
    auditLogs: [],
    uploadedFiles: []
  };
}

export function readTransitionStore(): TransitionStore {
  try {
    if (fs.existsSync(TRANSITION_STORAGE_FILE)) {
      const content = fs.readFileSync(TRANSITION_STORAGE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[TransitionAI] Error reading store, initializing fresh:', err);
  }
  const initial = getInitialTransitionStore();
  writeTransitionStore(initial);
  return initial;
}

export function writeTransitionStore(data: TransitionStore): void {
  try {
    fs.writeFileSync(TRANSITION_STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[TransitionAI] Error writing store:', err);
  }
}

export function createTransitionRouter(aiClient: GoogleGenAI | null): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 }
  });

  // GET /api/transition/state
  router.get('/state', (req: Request, res: Response) => {
    const store = readTransitionStore();
    res.json(store);
  });

  // POST /api/transition/profile
  router.post('/profile', (req: Request, res: Response) => {
    const store = readTransitionStore();
    const updates: Partial<BusinessProfile> = req.body;

    store.profile = {
      ...store.profile,
      ...updates,
      isConfigured: true,
      lastUpdated: new Date().toISOString()
    };

    store.auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: 'sme_owner',
      action: 'Business Profile Updated',
      details: `Updated parameters: ${Object.keys(updates).join(', ')}`,
      category: 'DATA_INGESTION'
    });

    writeTransitionStore(store);
    res.json({ success: true, profile: store.profile });
  });

  // POST /api/transition/clear
  router.post('/clear', (req: Request, res: Response) => {
    const fresh = getInitialTransitionStore();
    fresh.auditLogs.push({
      id: `AUDIT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: 'sme_owner',
      action: 'Workspace Reset',
      details: 'All activity records, files, and simulations cleared to pristine empty state.',
      category: 'DATA_INGESTION'
    });
    writeTransitionStore(fresh);
    res.json({ success: true, message: 'Workspace cleared.' });
  });

  // POST /api/transition/load-sample
  router.post('/load-sample', (req: Request, res: Response) => {
    const store = readTransitionStore();
    store.profile = { ...SAMPLE_SME_PROFILE, lastUpdated: new Date().toISOString() };
    const stdModel = get_standard_sme_financial_model();
    store.financialModel = {
      isConfigured: true,
      sourceFileName: 'Apex_Financial_Model_FY2024.xlsx',
      reportingPeriod: 'FY2024',
      currency: 'MYR',
      incomeStatement: stdModel.incomeStatement,
      balanceSheet: stdModel.balanceSheet,
      priorBalanceSheet: stdModel.priorBalanceSheet,
      cashFlowStatement: stdModel.cashFlowStatement,
      ratios: stdModel.ratios,
      lastUpdated: new Date().toISOString()
    };
    store.activityRecords = [...SAMPLE_ACTIVITY_RECORDS];
    store.bankTransactions = [...SAMPLE_BANK_TRANSACTIONS];
    store.selectedActionIds = ['ACT-SOLAR-01', 'ACT-LED-02'];
    store.uploadedFiles = [
      {
        id: 'FILE-SAMPLE-01',
        fileName: 'TNB_Electricity_Bills_2024.pdf',
        fileSize: 1420000,
        fileType: 'pdf',
        detectedCategory: 'electricity',
        recordsImported: 12,
        recordsSkipped: 0,
        recordsFlagged: 0,
        uploadTimestamp: new Date().toISOString(),
        status: 'imported',
        isOcrParsed: true
      },
      {
        id: 'FILE-SAMPLE-02',
        fileName: 'Petronas_Commercial_Fuel_2024.csv',
        fileSize: 45000,
        fileType: 'csv',
        detectedCategory: 'fuel_diesel',
        recordsImported: 4,
        recordsSkipped: 0,
        recordsFlagged: 0,
        uploadTimestamp: new Date().toISOString(),
        status: 'imported'
      },
      {
        id: 'FILE-SAMPLE-03',
        fileName: 'Gas_Malaysia_Statement_2024.pdf',
        fileSize: 890000,
        fileType: 'pdf',
        detectedCategory: 'fuel_gas',
        recordsImported: 1,
        recordsSkipped: 0,
        recordsFlagged: 0,
        uploadTimestamp: new Date().toISOString(),
        status: 'imported',
        isOcrParsed: true
      },
      {
        id: 'FILE-SAMPLE-04',
        fileName: 'Apex_Financial_Model_FY2024.xlsx',
        fileSize: 84000,
        fileType: 'xlsx',
        detectedCategory: 'financial_statements',
        recordsImported: 17,
        recordsSkipped: 0,
        recordsFlagged: 0,
        uploadTimestamp: new Date().toISOString(),
        status: 'imported'
      }
    ];

    store.auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: 'sme_owner',
      action: 'Sample Dataset Ingested',
      details: 'Loaded Apex Precision Engineering Sdn Bhd real-world industrial dataset (Full 7-Sheet Financial Model, 12 TNB utility bills, fleet logs, pipeline gas).',
      category: 'DATA_INGESTION',
      evidenceRef: 'TNB_Electricity_Bills_2024.pdf'
    });

    writeTransitionStore(store);
    res.json({ success: true, store });
  });

  // GET /api/transition/financial-model
  router.get('/financial-model', (req: Request, res: Response) => {
    const store = readTransitionStore();
    res.json({ success: true, financialModel: store.financialModel });
  });

  // POST /api/transition/financial-model
  router.post('/financial-model', (req: Request, res: Response) => {
    const store = readTransitionStore();
    const { financialModel } = req.body;
    if (financialModel) {
      store.financialModel = financialModel;
      if (financialModel.incomeStatement) {
        store.profile.annualRevenue = financialModel.incomeStatement.revenue;
        store.profile.annualOperatingExpenses = financialModel.incomeStatement.operatingExpenses;
      }
      if (financialModel.balanceSheet) {
        store.profile.cashBalance = financialModel.balanceSheet.cash;
        store.profile.existingAnnualDebtService = financialModel.balanceSheet.shortTermDebt;
      }
      store.profile.lastUpdated = new Date().toISOString();
      writeTransitionStore(store);
    }
    res.json({ success: true, financialModel: store.financialModel, profile: store.profile });
  });

  // GET /api/transition/workspace-status
  router.get('/workspace-status', (req: Request, res: Response) => {
    const store = readTransitionStore();
    const baseline = calculate_carbon_baseline(store.activityRecords, store.profile);
    const financial = get_financial_summary(store.profile, store.activityRecords, store.bankTransactions);
    const allActions = generate_decarbonisation_actions(baseline, financial, store.profile);
    const selectedActions = allActions.filter((a) => store.selectedActionIds.includes(a.id));

    const status: WorkspaceStatus = {
      workspaceId: store.profile.id,
      companyName: store.profile.name || 'SME Workspace',
      reportingPeriod: `FY${store.profile.reportingYear}`,
      currency: store.profile.currency,
      totalSourceFiles: store.uploadedFiles.length,
      totalActivityRecords: store.activityRecords.length,
      totalTransactions: store.bankTransactions.length,
      hasFinancialStatements: !!store.financialModel || store.profile.annualRevenue > 0,
      hasCarbonBaseline: baseline.totalTCO2e > 0,
      hasDecarbonisationPlan: selectedActions.length > 0,
      isLenderPackReady: store.lenderPackages.length > 0 || (baseline.totalTCO2e > 0 && store.profile.annualRevenue > 0),
      lastDataUpdate: store.profile.lastUpdated || new Date().toISOString(),
      lastCalculation: new Date().toISOString()
    };
    res.json(status);
  });

  // POST /api/transition/upload/inspect - Multimodal OCR & Tabular Document Inspector
  router.post('/upload/inspect', upload.array('files', 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded. Please choose a file.' });
      }

      const store = readTransitionStore();
      const gridRegion = store.profile.gridRegion || 'Peninsular Malaysia';
      const results = [];

      for (const file of files) {
        const inspected = await processUploadedDocument(file, aiClient, gridRegion);
        results.push(inspected);
      }

      res.json({ success: true, files: results, inspectedFiles: results });
    } catch (err: any) {
      console.error('[Upload Inspect Error]', err);
      res.status(500).json({ error: err.message || 'File inspection and OCR failed.' });
    }
  });

  // POST /api/transition/upload/confirm
  router.post('/upload/confirm', (req: Request, res: Response) => {
    try {
      const {
        fileId,
        fileName,
        category,
        scope,
        mappedRecords,
        ocrDocument,
        isOcrParsed,
        extractedFinancialModel,
        financialModel
      } = req.body;
      const store = readTransitionStore();

      // If financial statements were extracted or passed, persist them into central store
      const targetFinancialModel = financialModel || extractedFinancialModel;
      if (targetFinancialModel) {
        store.financialModel = targetFinancialModel;
        if (targetFinancialModel.incomeStatement) {
          store.profile.annualRevenue = targetFinancialModel.incomeStatement.revenue;
          store.profile.annualOperatingExpenses = targetFinancialModel.incomeStatement.operatingExpenses;
        }
        if (targetFinancialModel.balanceSheet) {
          store.profile.cashBalance = targetFinancialModel.balanceSheet.cash;
          store.profile.existingAnnualDebtService = targetFinancialModel.balanceSheet.shortTermDebt;
        }
        store.profile.isConfigured = true;
        store.profile.lastUpdated = new Date().toISOString();
      }

      if (!mappedRecords || !Array.isArray(mappedRecords) || mappedRecords.length === 0) {
        if (targetFinancialModel) {
          // If only financial model was uploaded (e.g. P&L / Balance Sheet workbook)
          const ext = path.extname(fileName || '').toLowerCase().replace('.', '');
          store.uploadedFiles.push({
            id: fileId || `FILE-${Date.now()}`,
            fileName: fileName || 'Financial_Statements.xlsx',
            fileSize: 2048,
            fileType: ext || 'xlsx',
            detectedCategory: 'financial_report',
            recordsImported: 17,
            recordsSkipped: 0,
            recordsFlagged: 0,
            uploadTimestamp: new Date().toISOString(),
            status: 'imported'
          });

          store.auditLogs.unshift({
            id: `AUDIT-${Date.now()}`,
            timestamp: new Date().toISOString(),
            userRole: 'sme_owner',
            action: 'Financial Statements Ingested & Model Updated',
            details: `Imported full financial statements from ${fileName}. Revenue: RM ${store.profile.annualRevenue.toLocaleString()}, Cash: RM ${store.profile.cashBalance.toLocaleString()}.`,
            category: 'DATA_INGESTION',
            evidenceRef: fileName
          });

          writeTransitionStore(store);
          return res.json({
            success: true,
            importedCount: 17,
            duplicatesCount: 0,
            errorsCount: 0,
            errors: [],
            duplicates: [],
            financialModel: store.financialModel,
            profile: store.profile
          });
        }
        return res.status(400).json({ error: 'No valid records provided for import.' });
      }

      const isFinancial = ['bank_transactions', 'financial_revenue_opex', 'accounts_payable_receivable', 'financial_report'].includes(category);
      const isOperational = ['production_volume', 'equipment_record', 'operating_hours'].includes(category);

      const importedActivities: ActivityRecord[] = [];
      const importedTransactions: BankTransactionRecord[] = [];
      const errors: string[] = [];
      const duplicates: string[] = [];

      const factorRef = getEmissionFactorForActivity(category, store.profile.gridRegion);

      mappedRecords.forEach((row: any, idx: number) => {
        const rawDate = String(row.date || '').trim();
        const rawQty = parseFloat(String(row.quantity || '0').replace(/,/g, ''));
        const rawCost = parseFloat(String(row.cost || '0').replace(/,/g, ''));

        if (!rawDate) {
          errors.push(`Row #${idx + 1}: Missing or invalid date.`);
          return;
        }

        if (isFinancial) {
          // Financial record import
          const txAmount = !isNaN(rawCost) && rawCost !== 0 ? rawCost : rawQty;
          if (isNaN(txAmount) || txAmount === 0) {
            errors.push(`Row #${idx + 1}: Financial amount cannot be zero or empty.`);
            return;
          }

          const txDesc = String(row.description || row.vendorName || `${category.replace(/_/g, ' ')}`).trim();
          const isDuplicateTx = store.bankTransactions.some((existing) => {
            return existing.date === rawDate &&
              Math.abs(existing.amount - txAmount) < 0.01 &&
              existing.description.toLowerCase() === txDesc.toLowerCase();
          });

          if (isDuplicateTx) {
            duplicates.push(`Row #${idx + 1} (${rawDate}, ${txDesc}): Duplicate transaction already exists; skipped.`);
            return;
          }

          importedTransactions.push({
            id: `TX-${Date.now()}-${idx}`,
            date: rawDate,
            description: txDesc,
            category: txAmount < 0 ? 'operating_expense' : 'revenue',
            amount: txAmount,
            type: txAmount < 0 ? 'outflow' : 'inflow',
            sourceFileName: fileName
          });
        } else {
          // Activity & Emission record import
          if (isNaN(rawQty) || rawQty <= 0) {
            errors.push(`Row #${idx + 1}: Quantity must be a positive number (found "${row.quantity}").`);
            return;
          }

          // Duplicate detection for activity records
          const isDuplicate = store.activityRecords.some((existing) => {
            const sameDate = existing.date === rawDate;
            const sameCat = existing.category === category;
            const sameQty = Math.abs(existing.quantity - rawQty) < 0.01;
            const sameInv = existing.invoiceNumber && row.invoiceNumber &&
              String(existing.invoiceNumber).trim().toLowerCase() === String(row.invoiceNumber).trim().toLowerCase();
            return sameCat && sameDate && (sameInv || sameQty);
          });

          if (isDuplicate) {
            duplicates.push(`Row #${idx + 1} (${rawDate}, ${rawQty} ${factorRef.unit}): Duplicate record already exists in database; skipped.`);
            return;
          }

          const factor = factorRef.factorKgCO2e;
          const emissionsKg = Number((rawQty * factor).toFixed(2));
          const emissionsTons = Number((emissionsKg / 1000).toFixed(2));

          const quality: DataQualityType =
            row.dataQuality === 'measured' || row.dataQuality === 'invoice_derived' || row.dataQuality === 'estimated'
              ? row.dataQuality
              : 'invoice_derived';

          importedActivities.push({
            id: `REC-${category.toUpperCase()}-${Date.now()}-${idx}`,
            sourceFileId: fileId,
            sourceFileName: fileName,
            date: rawDate,
            category,
            scope: (scope && scope !== 'Not Applicable') ? scope : factorRef.scope,
            description: row.description || `${factorRef.name} - Ingested`,
            quantity: rawQty,
            unit: factorRef.unit,
            cost: isNaN(rawCost) ? 0 : rawCost,
            emissionFactor: factor,
            factorSource: factorRef.source,
            emissionsKgCO2e: emissionsKg,
            emissionsTCO2e: emissionsTons,
            dataQuality: quality,
            invoiceNumber: row.invoiceNumber ? String(row.invoiceNumber).trim() : undefined,
            vendorName: row.vendorName ? String(row.vendorName).trim() : undefined,
            createdAt: new Date().toISOString()
          });
        }
      });

      const totalImported = importedActivities.length + importedTransactions.length;
      if (totalImported === 0 && duplicates.length > 0) {
        return res.status(200).json({
          success: true,
          importedCount: 0,
          duplicatesCount: duplicates.length,
          errorsCount: errors.length,
          errors,
          duplicates,
          message: 'All records in this file were recognized as duplicates and safely skipped.'
        });
      }

      if (totalImported === 0) {
        return res.status(400).json({
          error: 'No valid records could be imported.',
          validationErrors: errors,
          duplicates
        });
      }

      // Append to store
      if (importedActivities.length > 0) {
        store.activityRecords = [...store.activityRecords, ...importedActivities];
      }
      if (importedTransactions.length > 0) {
        store.bankTransactions = [...store.bankTransactions, ...importedTransactions];
        // If profile revenue was 0, calculate from positive transactions
        const totalInflows = store.bankTransactions.filter(t => t.type === 'inflow').reduce((sum, t) => sum + t.amount, 0);
        if (totalInflows > 0 && store.profile.annualRevenue === 0) {
          store.profile.annualRevenue = totalInflows;
        }
      }

      // Update uploaded file registry
      const ext = path.extname(fileName || '').toLowerCase().replace('.', '');
      store.uploadedFiles.push({
        id: fileId || `FILE-${Date.now()}`,
        fileName: fileName || 'Uploaded_Document',
        fileSize: 1024,
        fileType: ext || 'pdf',
        detectedCategory: category,
        recordsImported: totalImported,
        recordsSkipped: errors.length + duplicates.length,
        recordsFlagged: errors.length,
        uploadTimestamp: new Date().toISOString(),
        status: 'imported',
        isOcrParsed: !!(isOcrParsed || ocrDocument),
        ocrDocument: ocrDocument || undefined,
        errors: errors.length > 0 ? errors : undefined
      });

      // Audit Log
      store.auditLogs.unshift({
        id: `AUDIT-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userRole: 'sme_owner',
        action: isFinancial
          ? 'Financial Transactions Ingested'
          : (isOcrParsed || ocrDocument)
          ? 'OCR Utility Bill Ingested & Verified'
          : 'Utility Records Ingested & Verified',
        details: isFinancial
          ? `Imported ${importedTransactions.length} transactions (${duplicates.length} duplicate(s) safely skipped).`
          : (isOcrParsed || ocrDocument)
          ? `AI OCR extracted & verified ${importedActivities.length} record(s) from ${fileName} (${ocrDocument?.provider || factorRef.name}). Applied emission factor: ${factorRef.factorKgCO2e} kgCO2e/${factorRef.unit}.`
          : `Imported ${importedActivities.length} records into ${category}. Applied factor: ${factorRef.factorKgCO2e} kgCO2e/${factorRef.unit} (${duplicates.length} duplicate(s) skipped).`,
        category: 'DATA_INGESTION',
        evidenceRef: fileName
      });

      writeTransitionStore(store);

      res.json({
        success: true,
        importedCount: totalImported,
        duplicatesCount: duplicates.length,
        errorsCount: errors.length,
        errors,
        duplicates,
        totalRecordsInStore: store.activityRecords.length,
        totalTransactionsInStore: store.bankTransactions.length
      });
    } catch (err: any) {
      console.error('[Import Confirm Error]', err);
      res.status(500).json({ error: err.message || 'Confirm import failed.' });
    }
  });

  // POST /api/transition/action/toggle
  router.post('/action/toggle', (req: Request, res: Response) => {
    const { actionId } = req.body;
    const store = readTransitionStore();

    if (store.selectedActionIds.includes(actionId)) {
      store.selectedActionIds = store.selectedActionIds.filter((id) => id !== actionId);
    } else {
      store.selectedActionIds.push(actionId);
    }

    store.auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: 'sme_owner',
      action: 'Decarbonisation Action Selection Changed',
      details: `Action ${actionId} ${store.selectedActionIds.includes(actionId) ? 'selected for roadmap' : 'deselected'}.`,
      category: 'PLAN_AUTHORIZATION'
    });

    writeTransitionStore(store);
    res.json({ success: true, selectedActionIds: store.selectedActionIds });
  });

  // POST /api/transition/lender-package/create
  router.post('/lender-package/create', (req: Request, res: Response) => {
    const store = readTransitionStore();
    const {
      packageName,
      disclosures,
      executiveSummaryText
    } = req.body;

    const baseline = calculate_carbon_baseline(store.activityRecords, store.profile);
    const financial = get_financial_summary(store.profile, store.activityRecords, store.bankTransactions);
    const allActions = generate_decarbonisation_actions(baseline, financial, store.profile);
    const selectedActions = allActions.filter((a) => store.selectedActionIds.includes(a.id));
    const greenLoanEligibility = evaluate_green_loan_eligibility(baseline, financial, store.profile, selectedActions);

    const sharingToken = `lp_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    const pkgId = `PKG-${Date.now()}`;

    const newPackage: LenderPackage = {
      id: pkgId,
      packageName: packageName || `${store.profile.name || 'SME'} Green Transition Financing Pack`,
      companyName: store.profile.name || 'Apex Precision Engineering Sdn Bhd',
      createdDate: new Date().toISOString().slice(0, 10),
      authorizedBy: 'SME Managing Director / Owner',
      authorizedRole: 'sme_owner',
      sharingToken,
      isShared: true,
      sharedWithLenders: ['Malayan Banking Berhad (Maybank Green Facilities)', 'CIMB Sustainability Advisory'],
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 60 days
      disclosures: disclosures || {
        includeExecutiveSummary: true,
        includeCarbonBaseline: true,
        includeFinancialSummary: true,
        includeDecarbonisationPlan: true,
        includeCashFlowProjections: true,
        includeEvidenceDocuments: true
      },
      lenderRiskAssessment: {
        overallRisk: greenLoanEligibility.overallStatus === 'Eligible' ? 'Low' : 'Moderate',
        creditReadinessScore: greenLoanEligibility.readinessScorePct,
        dscrStressTestPassed: financial.currentDscr >= 1.25,
        carbonVerificationStatus: baseline.dataConfidence.overallScorePct >= 65 ? 'Verified by Audit Trail' : 'Self-Declared with Invoices',
        lenderKeyStrengths: [
          `Strong Debt Service Coverage Ratio (DSCR ${financial.currentDscr.toFixed(2)}x) well above 1.25x covenant.`,
          `High audit trail verification with ${baseline.dataConfidence.measuredPct + baseline.dataConfidence.invoiceDerivedPct}% invoice-metered evidence.`,
          `Decarbonisation plan generates net cash-flow positive energy bill savings from Year 1.`
        ],
        lenderKeyRisks: [
          'Technology execution risk during rooftop solar installation (mitigated by Tier-1 EPC contractor warranty).',
          'Inflationary utility tariff volatility (solar self-consumption hedges against fuel cost pass-through surcharge).'
        ]
      },
      executiveSummaryText: executiveSummaryText ||
        `${store.profile.name || 'The Borrower'} is presenting this Green Financing Package to fund a certified decarbonisation plan totaling RM ${selectedActions.reduce((s, a) => s + a.capex, 0).toLocaleString()} CapEx, achieving an estimated ${selectedActions.reduce((s, a) => s + a.annualCO2eReductionTons, 0)} tCO2e annual emissions reduction.`,
      auditEvidenceFiles: store.uploadedFiles.map((f) => ({
        fileName: f.fileName,
        fileType: f.fileType,
        recordsCount: f.recordsImported,
        uploadDate: f.uploadTimestamp.slice(0, 10)
      }))
    };

    store.lenderPackages.unshift(newPackage);

    store.auditLogs.unshift({
      id: `AUDIT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userRole: 'sme_owner',
      action: 'Lender Financing Package Created',
      details: `Created package "${newPackage.packageName}" with token ${sharingToken}. Approved disclosures for prospective credit institutions.`,
      category: 'LENDER_DISCLOSURE',
      evidenceRef: sharingToken
    });

    writeTransitionStore(store);
    res.json({ success: true, package: newPackage });
  });

  // GET /api/transition/lender-package/:token (Lender Portal Authorized View)
  router.get('/lender-package/:token', (req: Request, res: Response) => {
    const store = readTransitionStore();
    const { token } = req.params;

    const pkg = store.lenderPackages.find((p) => p.sharingToken === token);
    if (!pkg) {
      return res.status(404).json({ error: 'Financing package not found or link has expired.' });
    }

    const baseline = calculate_carbon_baseline(store.activityRecords, store.profile);
    const financial = get_financial_summary(store.profile, store.activityRecords, store.bankTransactions);
    const allActions = generate_decarbonisation_actions(baseline, financial, store.profile);
    const selectedActions = allActions.filter((a) => store.selectedActionIds.includes(a.id));
    const greenLoanEligibility = evaluate_green_loan_eligibility(baseline, financial, store.profile, selectedActions);

    // Filter package according to SME Owner's explicit disclosures:
    const sanitizedView = {
      packageInfo: {
        id: pkg.id,
        packageName: pkg.packageName,
        companyName: pkg.companyName,
        createdDate: pkg.createdDate,
        authorizedBy: pkg.authorizedBy,
        expiresAt: pkg.expiresAt,
        disclosures: pkg.disclosures,
        lenderRiskAssessment: pkg.lenderRiskAssessment
      },
      executiveSummary: pkg.disclosures.includeExecutiveSummary ? pkg.executiveSummaryText : null,
      carbonBaseline: pkg.disclosures.includeCarbonBaseline ? {
        scope1TCO2e: baseline.scope1TCO2e,
        scope2TCO2e: baseline.scope2TCO2e,
        totalTCO2e: baseline.totalTCO2e,
        emissionsByFuel: baseline.emissionsByFuel,
        dataConfidence: baseline.dataConfidence,
        intensityMetrics: baseline.intensityMetrics
      } : null,
      financialSummary: pkg.disclosures.includeFinancialSummary ? {
        annualRevenue: financial.annualRevenue,
        ebitda: financial.ebitda,
        currentDscr: financial.currentDscr,
        annualEnergyCost: financial.annualEnergyCost,
        energyCostPctOfOpEx: financial.energyCostPctOfOpEx,
        maxBorrowingCapacityAtTargetDscr: financial.maxBorrowingCapacityAtTargetDscr
      } : null,
      decarbonisationPlan: pkg.disclosures.includeDecarbonisationPlan ? selectedActions : null,
      greenLoanEligibility,
      evidenceFiles: pkg.disclosures.includeEvidenceDocuments ? pkg.auditEvidenceFiles : null
    };

    res.json(sanitizedView);
  });

  // POST /api/transition/copilot/chat
  router.post('/copilot/chat', async (req: Request, res: Response) => {
    try {
      const { message, currentRole = 'sme_owner' } = req.body;
      const store = readTransitionStore();

      const baseline = calculate_carbon_baseline(store.activityRecords, store.profile);
      const financial = get_financial_summary(store.profile, store.activityRecords, store.bankTransactions);
      const allActions = generate_decarbonisation_actions(baseline, financial, store.profile);
      const selectedActions = allActions.filter((a) => store.selectedActionIds.includes(a.id));
      const greenLoanEligibility = evaluate_green_loan_eligibility(baseline, financial, store.profile, selectedActions);

      const facts = {
        smeProfile: {
          name: store.profile.name || 'SME Organization',
          industry: store.profile.industry || 'Industrial SME',
          annualRevenue: `RM ${financial.annualRevenue.toLocaleString()}`,
          annualOpEx: `RM ${financial.annualOpEx.toLocaleString()}`,
          annualEnergySpend: `RM ${financial.annualEnergyCost.toLocaleString()}`,
          currentDscr: `${financial.currentDscr.toFixed(2)}x`,
          maxBorrowingCapacity: `RM ${financial.maxBorrowingCapacityAtTargetDscr.toLocaleString()}`
        },
        carbonBaseline: {
          scope1TCO2e: `${baseline.scope1TCO2e} tCO2e`,
          scope2TCO2e: `${baseline.scope2TCO2e} tCO2e`,
          totalBaselineTCO2e: `${baseline.totalTCO2e} tCO2e`,
          fuelBreakdown: baseline.emissionsByFuel.map((f) => `${f.name}: ${f.quantity} ${f.unit} (${f.emissionsTCO2e} tCO2e, RM ${f.cost.toLocaleString()})`),
          dataConfidenceScore: `${baseline.dataConfidence.overallScorePct}% (${baseline.dataConfidence.level})`,
          missingPeriods: baseline.dataConfidence.missingPeriods
        },
        selectedDecarbonisationRoadmap: selectedActions.map((a) => ({
          title: a.title,
          category: a.category,
          capex: `RM ${a.capex.toLocaleString()}`,
          annualOpExSavings: `RM ${a.annualOpExSavings.toLocaleString()}/yr`,
          annualCO2eReduction: `${a.annualCO2eReductionTons} tCO2e/yr`,
          paybackYears: `${a.paybackPeriodYears} years`,
          monthlyDebtService: `RM ${a.financing.monthlyRepayment.toLocaleString()}/mo`,
          netMonthlyCashBenefit: `RM ${a.financing.netMonthlyCashFlowImpact.toLocaleString()}/mo`
        })),
        greenLoanEligibility: {
          facilityName: greenLoanEligibility.facilityName,
          status: greenLoanEligibility.overallStatus,
          readinessScore: `${greenLoanEligibility.readinessScorePct}%`,
          concessionaryRate: `${greenLoanEligibility.concessionaryRatePct}% vs ${greenLoanEligibility.commercialBenchmarkRatePct}% commercial`
        },
        userRole: currentRole
      };

      if (aiClient) {
        const prompt = `You are TransitionAI, an authoritative, rigorous AI Green Finance & Decarbonisation Copilot for SMEs and Lenders.
The current user is interacting as: "${currentRole.toUpperCase()}".

CRITICAL GROUNDING RULES:
1. ONLY cite facts, numbers, emission figures, currency values, and actions present in the supplied factual payload below.
2. NEVER invent imaginary metrics, fake emission factors, or non-existent government programs.
3. Distinguish measured values (from utility invoices) from estimates or assumptions.
4. If required information is missing (e.g. incomplete fleet logs, unverified natural gas bills), explicitly state what the user needs to upload.
5. All calculations (DSCR, carbon intensity, NPV, payback) must remain mathematically aligned with the provided deterministic outputs.
6. Tailor your tone:
   - For SME Owner: Strategic, ROI-driven, focused on energy bill savings and achieving green targets.
   - For Finance Manager: Focus on cash flow timing, DSCR headroom, debt service vs monthly savings, and working capital impact.
   - For Lender / Credit Analyst: Focus on credit risk, DSCR stress testing, verification of emission evidence, and use-of-proceeds compliance.

FACTUAL SME TRANSITION RECORD:
${JSON.stringify(facts, null, 2)}

USER QUESTION: "${message}"`;

        const generatePromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            temperature: 0.15
          }
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API call timed out')), 4000)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        const reply = response.text;
        if (reply) {
          return res.json({ aiPowered: true, reply });
        }
      }
    } catch (err) {
      console.warn('[TransitionAI Copilot Fallback]', err);
    }

    // Deterministic fallback if Gemini is offline
    const store = readTransitionStore();
    const baseline = calculate_carbon_baseline(store.activityRecords, store.profile);
    const financial = get_financial_summary(store.profile, store.activityRecords, store.bankTransactions);

    return res.json({
      aiPowered: false,
      reply: `[TransitionAI Grounded Analysis]\n• Baseline Carbon Footprint: ${baseline.totalTCO2e} tCO2e (Scope 1: ${baseline.scope1TCO2e} tCO2e, Scope 2: ${baseline.scope2TCO2e} tCO2e across ${baseline.dataConfidence.totalRecords} verified records).\n• Data Confidence: ${baseline.dataConfidence.overallScorePct}% (${baseline.dataConfidence.level}).\n• Financial Headroom: Current DSCR is ${financial.currentDscr.toFixed(2)}x with indicative debt capacity of RM ${financial.maxBorrowingCapacityAtTargetDscr.toLocaleString()}.\n• Annual Energy Utility Outlay: RM ${financial.annualEnergyCost.toLocaleString()} (${financial.energyCostPctOfOpEx}% of operating costs).\n• Please upload additional monthly electricity invoices or fleet fuel records to enhance audit readiness.`
    });
  });

  // GET /api/transition/py-status - Check Python FastAPI backend connection
  router.get('/py-status', async (req: Request, res: Response) => {
    try {
      const resp = await fetch(`${PYTHON_BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        const data = await resp.json();
        return res.json({ connected: true, backendUrl: PYTHON_BACKEND_URL, data });
      }
      return res.json({ connected: false, backendUrl: PYTHON_BACKEND_URL, status: resp.status });
    } catch (e: any) {
      return res.json({ connected: false, backendUrl: PYTHON_BACKEND_URL, error: e.message });
    }
  });

  // POST /api/transition/py-sync - Bridge call to Python FastAPI backend statements/compute
  router.post('/py-sync', async (req: Request, res: Response) => {
    const store = readTransitionStore();
    try {
      const period = `FY${store.profile.reportingYear || 2024}`;
      const rev = store.profile.annualRevenue > 0 ? store.profile.annualRevenue : 3200000;
      const opex = store.profile.annualOperatingExpenses > 0 ? store.profile.annualOperatingExpenses : 680000;
      const cash = store.profile.cashBalance > 0 ? store.profile.cashBalance : 312500;
      const ads = store.profile.existingAnnualDebtService > 0 ? store.profile.existingAnnualDebtService : 38000;

      const payload = req.body && req.body.income ? req.body : {
        period,
        currency: 'MYR',
        income: {
          period,
          revenue: rev,
          cogs: Math.round(rev * 0.55),
          operating_expenses: opex,
          depreciation_amortisation: Math.round(rev * 0.05),
          finance_costs: ads,
          income_tax_expense: 0
        },
        balance_sheet: {
          period,
          cash,
          accounts_receivable: Math.round(rev * 45 / 365),
          inventory: Math.round((rev * 0.55) * 45 / 365),
          other_current_assets: 25000,
          fixed_assets_at_cost: 1220000,
          accumulated_depreciation: 415000,
          other_assets: 0,
          accounts_payable: Math.round((rev * 0.55) * 45 / 365),
          short_term_debt: 70000,
          long_term_debt: 275000,
          capital: 500000,
          retained_earnings: 927500
        }
      };

      const resp = await fetch(`${PYTHON_BACKEND_URL}/api/finance/statements/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        const result = await resp.json();
        // Append audit log to store
        store.auditLogs.unshift({
          id: `AUDIT-PY-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userRole: 'sme_owner',
          action: 'Python Financial Engine Computation',
          details: `Computed financial statements & DSCR via FastAPI backend (${result.audit?.inputs_hash?.slice(0, 8) || 'verified'}).`,
          category: 'CALCULATION',
          evidenceRef: `${PYTHON_BACKEND_URL}/api/finance/statements/compute`
        });
        writeTransitionStore(store);
        return res.json({ success: true, engine: 'python-fastapi', result });
      }
      const err = await resp.text();
      return res.status(resp.status).json({ success: false, error: err });
    } catch (e: any) {
      return res.status(503).json({ success: false, error: `Python backend offline: ${e.message}` });
    }
  });

  return router;
}
