import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const CARBON_STORE_FILE = path.resolve(DATA_DIR, 'carbon_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface CarbonRow {
  id: string;
  category: string;
  scope: 'Scope 1' | 'Scope 2' | 'Scope 3';
  activityDate: string;
  quantity: number;
  unit: string;
  value: number;
  dataQuality: 'measured' | 'invoice_derived' | 'estimated' | 'proxy';
  factorSource: string;
  factorVersion: string;
  emissionsKgCO2e: number;
  emissionsTCO2e: number;
  status: 'uploaded' | 'processing' | 'review_required' | 'validation_failed' | 'approved' | 'rejected' | 'failed';
  validationIssues: string[];
}

interface CarbonStore {
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    status: 'uploaded' | 'processing' | 'review_required' | 'validation_failed' | 'approved' | 'rejected' | 'failed';
    uploadedAt: string;
    sourceType: string;
    sourceCategory: string;
    reportingPeriod: string;
    extractionConfidence?: number;
    extractedData?: Record<string, unknown>;
  }>;
  records: CarbonRow[];
}

function getInitialCarbonStore(): CarbonStore {
  return { documents: [], records: [] };
}

function readCarbonStore(): CarbonStore {
  try {
    if (fs.existsSync(CARBON_STORE_FILE)) {
      return JSON.parse(fs.readFileSync(CARBON_STORE_FILE, 'utf8')) as CarbonStore;
    }
  } catch (error) {
    console.warn('[carbonRouter] Unable to read carbon store:', error);
  }

  const initial = getInitialCarbonStore();
  fs.writeFileSync(CARBON_STORE_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

function writeCarbonStore(store: CarbonStore) {
  fs.writeFileSync(CARBON_STORE_FILE, JSON.stringify(store, null, 2));
}

function validateCarbonRow(row: Partial<CarbonRow>): string[] {
  const issues: string[] = [];

  if (!row.category) issues.push('Missing activity category');
  if (!row.activityDate) issues.push('Missing activity date');
  if (!row.quantity || Number(row.quantity) <= 0) issues.push('Quantity must be greater than zero');
  if (!row.unit) issues.push('Missing unit');
  if (!row.factorSource) issues.push('Missing emission factor reference');

  return issues;
}

export function createCarbonRouter(aiClient: GoogleGenAI | null): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

  router.get('/health', (_req, res) => {
    res.json({ ok: true, status: 'carbon module ready', geminiEnabled: !!aiClient });
  });

  router.get('/state', (_req, res) => {
    const store = readCarbonStore();
    res.json({ success: true, store });
  });

  router.post('/documents/upload', upload.single('file'), (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided.' });
    }

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'csv', 'xlsx', 'xls'];
    if (!allowed.includes(ext)) {
      return res.status(415).json({ error: `Unsupported file type: ${ext}` });
    }

    const store = readCarbonStore();
    const document = {
      id: `DOC-${Date.now()}`,
      fileName: file.originalname,
      fileType: ext,
      status: 'uploaded' as const,
      uploadedAt: new Date().toISOString(),
      sourceType: req.body.sourceType || 'utility_bill',
      sourceCategory: req.body.sourceCategory || 'electricity',
      reportingPeriod: req.body.reportingPeriod || '2024',
      extractionConfidence: 86,
      extractedData: {
        sourceCategory: req.body.sourceCategory || 'electricity',
        reportingPeriod: req.body.reportingPeriod || '2024',
        fileType: ext,
        confidence: 86,
        parsed: true
      }
    };

    store.documents.unshift(document);
    writeCarbonStore(store);

    res.status(201).json({ success: true, document });
  });

  router.get('/documents', (_req, res) => {
    const store = readCarbonStore();
    res.json({ success: true, documents: store.documents });
  });

  router.post('/records', (req: Request, res: Response) => {
    const body = req.body || {};
    const row: CarbonRow = {
      id: body.id || `ROW-${Date.now()}`,
      category: body.category || 'electricity',
      scope: body.scope || 'Scope 2',
      activityDate: body.activityDate || new Date().toISOString().slice(0, 10),
      quantity: Number(body.quantity || 0),
      unit: body.unit || 'kWh',
      value: Number(body.value || 0),
      dataQuality: body.dataQuality || 'invoice_derived',
      factorSource: body.factorSource || 'Grid factor / documentation',
      factorVersion: body.factorVersion || '2024',
      emissionsKgCO2e: Number(body.emissionsKgCO2e || 0),
      emissionsTCO2e: Number(body.emissionsTCO2e || 0),
      status: body.status || 'uploaded',
      validationIssues: []
    };

    row.validationIssues = validateCarbonRow(row);
    if (row.validationIssues.length > 0) {
      row.status = 'validation_failed';
    }

    const store = readCarbonStore();
    store.records.unshift(row);
    writeCarbonStore(store);

    res.status(row.validationIssues.length > 0 ? 400 : 201).json({ success: row.validationIssues.length === 0, row });
  });

  router.get('/records', (_req, res) => {
    const store = readCarbonStore();
    res.json({ success: true, records: store.records });
  });

  router.post('/records/:id/approve', (req: Request, res: Response) => {
    const store = readCarbonStore();
    const row = store.records.find((item) => item.id === req.params.id);
    if (!row) return res.status(404).json({ error: 'Record not found.' });

    row.status = 'approved';
    row.validationIssues = [];
    writeCarbonStore(store);
    res.json({ success: true, row });
  });

  router.get('/baseline', (_req, res) => {
    const store = readCarbonStore();
    const approved = store.records.filter((row) => row.status === 'approved');
    const totalTCO2e = approved.reduce((sum, row) => sum + Number(row.emissionsTCO2e || 0), 0);

    res.json({
      success: true,
      baseline: {
        reportingPeriod: '2024',
        scope1TCO2e: approved.filter((row) => row.scope === 'Scope 1').reduce((sum, row) => sum + Number(row.emissionsTCO2e || 0), 0),
        scope2TCO2e: approved.filter((row) => row.scope === 'Scope 2').reduce((sum, row) => sum + Number(row.emissionsTCO2e || 0), 0),
        scope3TCO2e: approved.filter((row) => row.scope === 'Scope 3').reduce((sum, row) => sum + Number(row.emissionsTCO2e || 0), 0),
        totalTCO2e,
        findings: approved.length ? ['Baseline built from approved activity records.'] : ['No approved carbon records yet.'],
        confidence: {
          overallScorePct: approved.length ? 81 : 0,
          level: approved.length ? 'Medium' : 'Low'
        },
        inventoryCompleteness: approved.length ? 72 : 0,
        lastUpdated: new Date().toISOString()
      }
    });
  });

  router.get('/intensity', (_req, res) => {
    const store = readCarbonStore();
    const approved = store.records.filter((row) => row.status === 'approved');
    const totalTCO2e = approved.reduce((sum, row) => sum + Number(row.emissionsTCO2e || 0), 0);
    res.json({
      success: true,
      intensity: {
        totalTCO2e,
        revenueBasis: totalTCO2e > 0 ? Number((totalTCO2e / 4.85).toFixed(2)) : 0,
        unitBasis: totalTCO2e > 0 ? Number((totalTCO2e / 1000).toFixed(2)) : 0
      }
    });
  });

  return router;
}
