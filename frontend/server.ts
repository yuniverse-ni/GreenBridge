import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import { createTransitionRouter } from './src/server/transitionRouter';
import { createCarbonRouter } from './src/server/carbonRouter';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

function listenWithFallback(port: number, maxAttempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryListen = (currentPort: number, remainingAttempts: number) => {
      const server = app.listen(currentPort, HOST, () => {
        resolve(currentPort);
      });

      server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          if (remainingAttempts > 0) {
            console.warn(`[CashPilot Server] Port ${currentPort} is busy; retrying on ${currentPort + 1}.`);
            server.close(() => tryListen(currentPort + 1, remainingAttempts - 1));
            return;
          }

          reject(new Error(`No free port was available starting from ${port}.`));
          return;
        }

        reject(error);
      });
    };

    tryListen(port, maxAttempts);
  });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer setup for file uploads (in-memory buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } // 30 MB max
});

// Setup Server-Side Persistent Storage
const DATA_DIR = path.resolve(__dirname, 'data');
const STORAGE_FILE = path.resolve(DATA_DIR, 'financial_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoredFinancialData {
  profile: {
    id: string;
    name: string;
    registrationNumber?: string;
    industry?: string;
    currency: string;
    initialCashSen: number;
    minReserveSen: number;
    forecastHorizonDays: number;
    bankName?: string;
    accountNumberMasked?: string;
    isConfigured: boolean;
    lastUpdated?: string;
  };
  invoices: any[];
  bills: any[];
  bankTransactions: any[];
  auditLogs: any[];
  proposedActions: any[];
  uploadedFiles: any[];
}

function getInitialStore(): StoredFinancialData {
  return {
    profile: {
      id: 'BIZ-USER',
      name: '',
      currency: 'MYR',
      initialCashSen: 0,
      minReserveSen: 0,
      forecastHorizonDays: 30,
      isConfigured: false
    },
    invoices: [],
    bills: [],
    bankTransactions: [],
    auditLogs: [],
    proposedActions: [],
    uploadedFiles: []
  };
}

function readStore(): StoredFinancialData {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[CashPilot Storage] Error reading store, initializing fresh:', err);
  }
  const initial = getInitialStore();
  writeStore(initial);
  return initial;
}

function writeStore(data: StoredFinancialData): void {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CashPilot Storage] Error writing store:', err);
  }
}

// Initialize Gemini SDK with telemetry header per skill guidelines
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('[CashPilot Backend] Gemini 3.8 Flash initialized successfully.');
  } catch (err) {
    console.warn('[CashPilot Backend] Gemini initialization warning:', err);
  }
} else {
  console.log('[CashPilot Backend] Gemini API key not provided; fallback rules engine active.');
}

// Mount TransitionAI green finance & decarbonisation copilot routes
app.use('/api/transition', createTransitionRouter(aiClient));
app.use('/api/carbon', createCarbonRouter(aiClient));

// Health check
app.get('/api/health', (req, res) => {
  const store = readStore();
  res.json({
    status: 'ok',
    geminiActive: !!aiClient,
    isDataLoaded: store.profile.isConfigured || store.invoices.length > 0 || store.bills.length > 0,
    timestamp: new Date().toISOString()
  });
});

// GET current persistent financial data
app.get('/api/financial-data', (req, res) => {
  const store = readStore();
  res.json(store);
});

// Reset / Clear financial data
app.delete('/api/financial-data', (req, res) => {
  const initial = getInitialStore();
  writeStore(initial);
  res.json({ success: true, message: 'All financial records and uploaded files cleared.' });
});

// Update Profile & Settings
app.post('/api/financial-data/settings', (req, res) => {
  const store = readStore();
  const { name, currency, initialCashSen, minReserveSen, forecastHorizonDays, bankName } = req.body;

  if (name !== undefined) store.profile.name = name;
  if (currency !== undefined) store.profile.currency = currency;
  if (initialCashSen !== undefined) store.profile.initialCashSen = Number(initialCashSen);
  if (minReserveSen !== undefined) store.profile.minReserveSen = Number(minReserveSen);
  if (forecastHorizonDays !== undefined) store.profile.forecastHorizonDays = Number(forecastHorizonDays);
  if (bankName !== undefined) store.profile.bankName = bankName;
  store.profile.isConfigured = true;
  store.profile.lastUpdated = new Date().toISOString();

  writeStore(store);
  res.json({ success: true, profile: store.profile });
});

// Helper to auto-suggest column mapping from headers
function suggestColumnMapping(headers: string[]): Record<string, string> {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  const mapping: Record<string, string> = {
    idColumn: '',
    entityColumn: '',
    amountColumn: '',
    dateColumn: '',
    dueDateColumn: '',
    typeColumn: '',
    categoryColumn: '',
    statusColumn: ''
  };

  // Find ID
  const idIdx = lowerHeaders.findIndex((h) =>
    h.includes('invoice') || h.includes('id') || h.includes('ref') || h.includes('bill_no') || h.includes('code')
  );
  if (idIdx !== -1) mapping.idColumn = headers[idIdx];

  // Find Entity / Name
  const entityIdx = lowerHeaders.findIndex((h) =>
    h.includes('customer') || h.includes('client') || h.includes('vendor') || h.includes('supplier') || h.includes('name') || h.includes('payee') || h.includes('entity') || h.includes('party')
  );
  if (entityIdx !== -1) mapping.entityColumn = headers[entityIdx];
  else {
    const descIdx = lowerHeaders.findIndex((h) => h.includes('description') || h.includes('narrative'));
    if (descIdx !== -1) mapping.entityColumn = headers[descIdx];
  }

  // Find Amount
  const amountIdx = lowerHeaders.findIndex((h) =>
    h.includes('amount') || h.includes('total') || h.includes('balance') || h.includes('myr') || h.includes('price') || h.includes('val')
  );
  if (amountIdx !== -1) mapping.amountColumn = headers[amountIdx];

  // Find Date
  const dateIdx = lowerHeaders.findIndex((h) =>
    (h.includes('date') && !h.includes('due')) || h.includes('issue') || h.includes('created') || h.includes('tx_date')
  );
  if (dateIdx !== -1) mapping.dateColumn = headers[dateIdx];

  // Find Due Date
  const dueDateIdx = lowerHeaders.findIndex((h) =>
    h.includes('due') || h.includes('maturity') || h.includes('deadline')
  );
  if (dueDateIdx !== -1) mapping.dueDateColumn = headers[dueDateIdx];
  else if (dateIdx !== -1) mapping.dueDateColumn = headers[dateIdx];

  // Find Type
  const typeIdx = lowerHeaders.findIndex((h) =>
    h.includes('type') || h.includes('dr_cr') || h.includes('direction')
  );
  if (typeIdx !== -1) mapping.typeColumn = headers[typeIdx];

  // Find Category
  const catIdx = lowerHeaders.findIndex((h) =>
    h.includes('category') || h.includes('desc') || h.includes('service') || h.includes('item')
  );
  if (catIdx !== -1) mapping.categoryColumn = headers[catIdx];

  // Find Status
  const statusIdx = lowerHeaders.findIndex((h) =>
    h.includes('status') || h.includes('state')
  );
  if (statusIdx !== -1) mapping.statusColumn = headers[statusIdx];

  return mapping;
}

// Detect category from filename and headers
function detectCategory(fileName: string, headers: string[]): 'invoices' | 'bills' | 'transactions' | 'mixed' {
  const fn = fileName.toLowerCase();
  const hd = headers.join(' ').toLowerCase();

  if (fn.includes('invoice') || fn.includes('receivable') || fn.includes('ar_') || hd.includes('customer') || hd.includes('client')) {
    return 'invoices';
  }
  if (fn.includes('bill') || fn.includes('payable') || fn.includes('ap_') || fn.includes('supplier') || hd.includes('vendor') || hd.includes('supplier')) {
    return 'bills';
  }
  if (fn.includes('bank') || fn.includes('statement') || fn.includes('trans') || hd.includes('debit') || hd.includes('credit') || hd.includes('balance')) {
    return 'transactions';
  }
  return 'mixed';
}

// POST /api/upload - Accepts multi-file uploads (CSV, XLSX, XLS, PDF) and returns inspection preview
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided.' });
    }

    const previewBatches: any[] = [];

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      const fileName = file.originalname;
      const ext = path.extname(fileName).toLowerCase();
      const fileId = `FILE-${Date.now()}-${fIdx}`;

      let headers: string[] = [];
      let rawRows: Record<string, any>[] = [];

      if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
        // Parse spreadsheet using sheetjs
        const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonData.length > 0) {
          headers = Object.keys(jsonData[0]);
          rawRows = jsonData;
        }
      } else if (ext === '.pdf') {
        try {
          const { PDFParse } = await import('pdf-parse');
          const parser = new PDFParse({ data: file.buffer });
          const textResult = await parser.getText();
          const lines = (textResult.text || '').split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
          await parser.destroy();

          // Extract table-like lines or invoice fields from text
          headers = ['Reference', 'Entity_or_Description', 'Date', 'Amount_MYR'];
          const extractedRows: Record<string, any>[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for patterns like Date YYYY-MM-DD or DD/MM/YYYY and amount
            const dateMatch = line.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})\b/);
            const amountMatch = line.match(/\b(?:RM\s*|MYR\s*|\$)?(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\b/i);

            if (amountMatch) {
              const amount = amountMatch[1].replace(/,/g, '');
              const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
              const desc = line.replace(amountMatch[0], '').replace(dateMatch ? dateMatch[0] : '', '').trim() || `PDF Line Record #${i + 1}`;

              extractedRows.push({
                Reference: `PDF-REC-${i + 1}`,
                Entity_or_Description: desc.slice(0, 80),
                Date: date,
                Amount_MYR: amount
              });
            }
          }

          rawRows = extractedRows.length > 0 ? extractedRows : [{
            Reference: 'PDF-EXTRACT',
            Entity_or_Description: lines.slice(0, 3).join(' '),
            Date: new Date().toISOString().slice(0, 10),
            Amount_MYR: '0.00'
          }];
        } catch (pdfErr) {
          console.warn('[PDF Parser Error]', pdfErr);
          headers = ['Raw_Line_Content'];
          rawRows = [{ Raw_Line_Content: 'Unable to parse PDF text stream.' }];
        }
      } else {
        return res.status(400).json({ error: `Unsupported file extension: ${ext}. Please upload .csv, .xlsx, .xls, or .pdf.` });
      }

      const suggestedMapping = suggestColumnMapping(headers);
      const detectedCategory = detectCategory(fileName, headers);

      previewBatches.push({
        fileId,
        fileName,
        fileSize: file.size,
        fileType: ext.replace('.', '').toUpperCase(),
        detectedCategory,
        headers,
        rawRows: rawRows.slice(0, 50), // preview sample
        totalRows: rawRows.length,
        suggestedMapping,
        fullRows: rawRows
      });
    }

    res.json({ success: true, previewBatches });
  } catch (err: any) {
    console.error('[Upload Handler Error]', err);
    res.status(500).json({ error: err.message || 'File upload and inspection failed.' });
  }
});

// Helper date parser into YYYY-MM-DD
function normalizeDate(raw: any): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  const str = String(raw).trim();
  // Handle DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  // Standard parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

// POST /api/import/confirm - Validates and merges confirmed mapped files into persistent store
app.post('/api/import/confirm', (req, res) => {
  try {
    const { batches, profileUpdates } = req.body;
    if (!batches || !Array.isArray(batches)) {
      return res.status(400).json({ error: 'No batches provided for import confirmation.' });
    }

    const store = readStore();
    const importedInvoices: any[] = [];
    const importedBills: any[] = [];
    const importedTransactions: any[] = [];
    const importErrors: any[] = [];

    const today = new Date('2026-10-15T00:00:00Z');

    for (const batch of batches) {
      const { fileName, category, rows, mapping } = batch;
      if (!rows || !Array.isArray(rows)) continue;

      const seenIds = new Set<string>();

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const rowNum = rIdx + 1;

        // Extract values using user-confirmed mapping
        const rawId = mapping.idColumn ? String(row[mapping.idColumn] || '').trim() : '';
        const rawEntity = mapping.entityColumn ? String(row[mapping.entityColumn] || '').trim() : '';
        const rawAmount = mapping.amountColumn ? row[mapping.amountColumn] : '';
        const rawDate = mapping.dateColumn ? row[mapping.dateColumn] : '';
        const rawDueDate = mapping.dueDateColumn ? row[mapping.dueDateColumn] : rawDate;
        const rawCategory = mapping.categoryColumn ? String(row[mapping.categoryColumn] || '').trim() : '';
        const rawStatus = mapping.statusColumn ? String(row[mapping.statusColumn] || '').toLowerCase() : '';

        // Validation Checks
        const amountNum = parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
        if (isNaN(amountNum) || amountNum <= 0) {
          importErrors.push({
            file: fileName,
            row: rowNum,
            issue: `Invalid or non-positive amount value: "${rawAmount}".`,
            recordData: row
          });
          continue;
        }

        const id = rawId || `${category.toUpperCase().slice(0, 3)}-${Date.now()}-${rowNum}`;
        if (seenIds.has(id)) {
          importErrors.push({
            file: fileName,
            row: rowNum,
            issue: `Duplicate record identifier: "${id}".`,
            recordData: row
          });
          continue;
        }
        seenIds.add(id);

        const entity = rawEntity || 'Unspecified Entity';
        const date = normalizeDate(rawDate);
        const dueDate = normalizeDate(rawDueDate);
        const amountSen = Math.round(amountNum * 100);

        // Calculate day offset from today
        const dueDateObj = new Date(dueDate);
        const diffTime = dueDateObj.getTime() - today.getTime();
        const dueDayOffset = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
        const daysOverdue = diffTime < 0 ? Math.abs(Math.round(diffTime / (1000 * 60 * 60 * 24))) : 0;

        if (category === 'invoices') {
          importedInvoices.push({
            id,
            customerName: entity,
            customerContact: 'Accounts Department',
            customerEmail: '',
            amountSen,
            issueDate: date,
            dueDate,
            daysOverdue,
            status: rawStatus.includes('paid') ? 'paid' : daysOverdue > 0 ? 'overdue' : 'sent',
            category: rawCategory || 'Customer Invoice',
            description: `Invoice ${id} - ${entity}`,
            sourceFileName: fileName
          });
        } else if (category === 'bills') {
          importedBills.push({
            id,
            vendorName: entity,
            vendorContact: 'Accounts Payable',
            amountSen,
            dueDate,
            dueDayOffset,
            status: rawStatus.includes('paid') ? 'paid' : 'unpaid',
            category: rawCategory || 'Operational Expense',
            description: `Payable ${id} - ${entity}`,
            canNegotiate: true,
            sourceFileName: fileName
          });
        } else {
          // Bank Transactions
          const isDebit = String(rawCategory).toLowerCase().includes('debit') ||
            String(rawEntity).toLowerCase().includes('payment') ||
            String(row[mapping.typeColumn || '']).toLowerCase().includes('debit');

          importedTransactions.push({
            id,
            date,
            description: entity,
            reference: id,
            type: isDebit ? 'Debit' : 'Credit',
            amountSen,
            sourceFileName: fileName
          });
        }
      }

      // Add to uploaded files manifest
      store.uploadedFiles.push({
        fileId: `FILE-${Date.now()}`,
        fileName,
        uploadedAt: new Date().toISOString(),
        recordCount: rows.length,
        category
      });
    }

    // Merge into store
    store.invoices = [...store.invoices, ...importedInvoices];
    store.bills = [...store.bills, ...importedBills];
    store.bankTransactions = [...store.bankTransactions, ...importedTransactions];

    if (profileUpdates) {
      if (profileUpdates.name) store.profile.name = profileUpdates.name;
      if (profileUpdates.currency) store.profile.currency = profileUpdates.currency;
      if (profileUpdates.initialCashSen !== undefined) store.profile.initialCashSen = Number(profileUpdates.initialCashSen);
      if (profileUpdates.minReserveSen !== undefined) store.profile.minReserveSen = Number(profileUpdates.minReserveSen);
      if (profileUpdates.forecastHorizonDays) store.profile.forecastHorizonDays = Number(profileUpdates.forecastHorizonDays);
    }

    store.profile.isConfigured = true;
    store.profile.lastUpdated = new Date().toISOString();

    // Audit log
    store.auditLogs.push({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      stepNumber: 1,
      stage: 'Financial Records Imported',
      summary: `Imported ${importedInvoices.length} invoices, ${importedBills.length} bills, ${importedTransactions.length} transactions`,
      detail: `Data ingested across ${batches.length} file(s). ${importErrors.length} invalid rows flagged.`,
      actor: 'Business Owner (You)',
      statusBadge: importErrors.length > 0 ? 'flagged' : 'completed'
    });

    writeStore(store);

    res.json({
      success: true,
      imported: {
        invoicesCount: importedInvoices.length,
        billsCount: importedBills.length,
        transactionsCount: importedTransactions.length
      },
      errors: importErrors,
      data: store
    });
  } catch (err: any) {
    console.error('[Import Confirm Error]', err);
    res.status(500).json({ error: err.message || 'Import confirmation failed.' });
  }
});

// POST /api/financial-data/record-payment - Records real payment receipt
app.post('/api/financial-data/record-payment', (req, res) => {
  const store = readStore();
  const { invoiceId, amountSen, paymentReference } = req.body;

  const invoice = store.invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }
  if (invoice.status === 'paid') {
    return res.status(400).json({ error: 'Invoice already marked as paid.' });
  }

  const payAmount = Number(amountSen) || invoice.amountSen;
  invoice.status = 'paid';
  invoice.daysOverdue = 0;
  invoice.simulatedPaidDate = new Date().toISOString().slice(0, 10);

  // Credit bank balance
  store.profile.initialCashSen += payAmount;

  // Audit log
  store.auditLogs.push({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    stepNumber: 8,
    stage: 'Payment Reconciled',
    summary: `Settlement Received: RM ${(payAmount / 100).toFixed(2)} from ${invoice.customerName}`,
    detail: `Payment reference #${paymentReference || 'DUITNOW-SETTLE'}. Cash balance credited. Invoice ${invoice.id} marked PAID.`,
    actor: 'Bank Gateway',
    statusBadge: 'completed'
  });

  writeStore(store);
  res.json({ success: true, invoice, updatedBalanceSen: store.profile.initialCashSen });
});

// AI Financial Copilot Grounded Chat Endpoint
app.post('/api/ai/copilot-chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const store = readStore();

    const cashRM = (store.profile.initialCashSen / 100).toFixed(2);
    const reserveRM = (store.profile.minReserveSen / 100).toFixed(2);

    // Build fact payload from actual store
    const factsPayload = {
      businessName: store.profile.name || 'User Business',
      currency: store.profile.currency || 'MYR',
      availableCash: `RM ${cashRM}`,
      minimumReserve: `RM ${reserveRM}`,
      invoicesSummary: store.invoices.map((i) => ({
        id: i.id,
        customer: i.customerName,
        amountRM: (i.amountSen / 100).toFixed(2),
        dueDate: i.dueDate,
        daysOverdue: i.daysOverdue,
        status: i.status
      })),
      billsSummary: store.bills.map((b) => ({
        id: b.id,
        vendor: b.vendorName,
        amountRM: (b.amountSen / 100).toFixed(2),
        dueDate: b.dueDate,
        dueDayOffset: b.dueDayOffset,
        status: b.status
      })),
      recentTransactionsCount: store.bankTransactions.length
    };

    if (aiClient) {
      const prompt = `You are CashPilot, an intelligent, trustworthy AI financial participant for small businesses.
Answer the user's question about their cash flow.

CRITICAL RULES:
1. ONLY cite facts, invoice IDs, dates, and amounts present in the supplied financial data below.
2. NEVER invent imaginary customers, invoices, transactions, or fake balances.
3. If an answer cannot be determined from the uploaded data, state clearly: "Based on your uploaded records, that information is not available. Please upload the relevant bank statement or invoice file."
4. Be concise, clear, and actionable.

UPLOADED FINANCIAL DATA FACTS:
${JSON.stringify(factsPayload, null, 2)}

USER QUESTION: "${message}"`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.1
        }
      });

      const text = response.text;
      if (text) {
        return res.json({ aiPowered: true, reply: text });
      }
    }
  } catch (error) {
    console.warn('[AI Copilot Chat Fallback]', error);
  }

  // Deterministic Grounded Fallback
  const store = readStore();
  const unpaidInvoices = store.invoices.filter((i) => i.status !== 'paid');
  const unpaidBills = store.bills.filter((b) => b.status !== 'paid');
  const totalBills = unpaidBills.reduce((acc, b) => acc + b.amountSen, 0) / 100;
  const currentCash = store.profile.initialCashSen / 100;

  return res.json({
    aiPowered: false,
    reply: `Based on your uploaded records: Your current cleared cash is RM ${currentCash.toFixed(2)}, with upcoming bills totaling RM ${totalBills.toFixed(2)} across ${unpaidBills.length} vendor obligations. You have ${unpaidInvoices.length} outstanding invoice(s). ${
      currentCash < totalBills
        ? `Warning: Upcoming bills exceed current cash by RM ${(totalBills - currentCash).toFixed(2)}.`
        : 'All current scheduled commitments are covered by available liquidity.'
    }`
  });
});

// Setup Vite middleware in dev or static serve in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[CashPilot] Vite dev middleware attached.');
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  try {
    const actualPort = await listenWithFallback(DEFAULT_PORT);
    console.log(`[CashPilot Server] Running on http://${HOST}:${actualPort}`);
  } catch (err) {
    console.error('[CashPilot Server] Unable to bind a local port:', err);
    process.exit(1);
  }
}

startServer();
