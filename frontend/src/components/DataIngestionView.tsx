// TransitionAI — Real File Ingestion, Multimodal OCR, Column Mapping & Validation Engine
import React, { useState, useRef, useEffect } from 'react';
import { useTransition } from '../context/TransitionContext';
import {
  ActivityCategory,
  EmissionScope,
  DataQualityType,
  UploadContext,
  OcrExtractedDocument
} from '../types/transition';
import { generateSampleCsvContent } from '../data/sampleDatasets';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Trash2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Info,
  Zap,
  Building,
  Coins,
  ShieldCheck,
  Check,
  AlertTriangle,
  Cpu,
  Eye,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';

const documentLabels: Record<string, string> = {
  electricity: 'Electricity Bill', fuel_diesel: 'Diesel Record', fuel_petrol: 'Petrol Record',
  fuel_gas: 'Gas Statement', fuel_lpg: 'LPG Record', water: 'Water Bill', refrigerant: 'Refrigerant Record',
  bank_transactions: 'Bank Statement', financial_statements: 'Financial Statement', financial_report: 'Financial Report',
  financial_revenue_opex: 'Revenue & Expenses', accounts_payable_receivable: 'Payables & Receivables',
  production_volume: 'Production Record', equipment_record: 'Equipment Record', operating_hours: 'Operating Hours', mixed: 'Business Records',
};

interface InspectedFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  detectedCategory: ActivityCategory | 'bank_transactions' | 'mixed';
  headers: string[];
  sampleRows: any[];
  totalSampleCount: number;
  suggestedMapping: Record<string, string>;
  isOcrParsed?: boolean;
  ocrDocument?: OcrExtractedDocument;
}

export const DataIngestionView: React.FC = () => {
  const {
    uploadContext,
    setUploadContext,
    returnSourceSection,
    setReturnSourceSection,
    inspectFiles,
    confirmImport,
    uploadedFiles,
    activityRecords,
    loadSampleData,
    setActiveTab,
    refreshState,
    isLoading,
    pythonEngineStatus,
    uploadToPythonEngine
  } = useTransition();

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrProgressMsg, setOcrProgressMsg] = useState<string>('');
  const [inspectedFiles, setInspectedFiles] = useState<InspectedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Field Mapping State for the currently selected inspected file
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>('electricity');
  const [selectedScope, setSelectedScope] = useState<EmissionScope>('Scope 2');
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({
    date: '',
    quantity: '',
    unit: '',
    cost: '',
    invoiceNumber: '',
    vendorName: '',
    dataQuality: ''
  });
  const [defaultQuality, setDefaultQuality] = useState<DataQualityType>('invoice_derived');

  // Preselect energy category if opened with energy_emissions context
  useEffect(() => {
    if (uploadContext === 'energy_emissions') {
      setSelectedCategory('electricity');
      setSelectedScope('Scope 2');
    }
  }, [uploadContext]);

  // Import feedback
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    importedCount: number;
    errorsCount: number;
    errors: string[];
    duplicatesCount?: number;
    duplicates?: string[];
    message?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Return navigation back to origin
  const handleReturnToOrigin = () => {
    setActiveTab('overview');
    if (returnSourceSection === 'activity_evidence') {
      setTimeout(() => {
        const el = document.getElementById('activity-evidence-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle files selected via input or drop
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setImportStatus(null);
    setOcrProgressMsg('Reading your documents...');

    try {
      const fileArray = Array.from(files);
      const parsedFiles = await inspectFiles(fileArray);
      setInspectedFiles(parsedFiles);

      if (parsedFiles.length > 0) {
        setActiveFileIndex(0);
        applyFileDefaults(parsedFiles[0]);
        // Auto-scroll smoothly so user instantly sees the output card
        setTimeout(() => {
          const el = document.getElementById('inspected-files-preview');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      } else {
        setErrorMessage('No tabular or utility data could be extracted from the file.');
      }
    } catch (err: any) {
      setErrorMessage(`File inspection failed: ${err.message || 'Unable to parse document'}`);
    } finally {
      setIsProcessing(false);
      setOcrProgressMsg('');
    }
  };

  const applyFileDefaults = (file: InspectedFile) => {
    let cat: ActivityCategory = file.detectedCategory !== 'mixed' ? (file.detectedCategory as ActivityCategory) : 'electricity';
    if (file.ocrDocument?.category) {
      cat = file.ocrDocument.category;
    } else if (file.detectedCategory === 'fuel_diesel' || file.detectedCategory === 'fuel_petrol' || file.detectedCategory === 'fuel_gas') {
      cat = file.detectedCategory;
    } else if (file.detectedCategory === 'bank_transactions') {
      cat = 'bank_transactions';
    } else if (uploadContext === 'energy_emissions') {
      cat = 'electricity';
    }

    setSelectedCategory(cat);
    setSelectedScope(
      file.ocrDocument?.scope ||
      (cat === 'electricity' ? 'Scope 2' :
       cat.startsWith('fuel_') ? 'Scope 1' : 'Not Applicable')
    );

    setFieldMappings({
      date: file.suggestedMapping['date'] || '',
      quantity: file.suggestedMapping['quantity'] || '',
      unit: file.suggestedMapping['unit'] || '',
      cost: file.suggestedMapping['cost'] || '',
      invoiceNumber: file.suggestedMapping['invoiceNumber'] || '',
      vendorName: file.suggestedMapping['vendorName'] || '',
      dataQuality: file.suggestedMapping['dataQuality'] || ''
    });

    // If it's an OCR-parsed document, keep advanced column mapping collapsed by default for clean UX
    setShowAdvancedMapping(!file.isOcrParsed);
  };

  const currentFile = inspectedFiles[activeFileIndex];

  // Execute Import confirmation
  const handleConfirmImport = async () => {
    if (!currentFile) return;

    // For OCR documents, we use the OCR fields directly if mapping isn't fully configured
    const dateField = fieldMappings.date || 'Date';
    const qtyField = fieldMappings.quantity || 'Quantity';

    // Validate that we have valid rows or OCR document
    if (!currentFile.isOcrParsed && (!fieldMappings.date || !fieldMappings.quantity)) {
      setErrorMessage('Please map at least the Date and Quantity columns before confirming import.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Map rows from inspected sample rows or parsed data
      const mappedRecords = currentFile.sampleRows.map((row: any) => ({
        date: row[dateField] !== undefined ? row[dateField] : currentFile.ocrDocument?.billingPeriodOrDate,
        quantity: row[qtyField] !== undefined ? row[qtyField] : currentFile.ocrDocument?.quantity,
        cost: fieldMappings.cost && row[fieldMappings.cost] !== undefined
          ? row[fieldMappings.cost]
          : (row['TotalCost'] || currentFile.ocrDocument?.totalCost || 0),
        invoiceNumber: fieldMappings.invoiceNumber && row[fieldMappings.invoiceNumber] !== undefined
          ? row[fieldMappings.invoiceNumber]
          : (row['InvoiceNumber'] || currentFile.ocrDocument?.accountOrInvoiceNo || ''),
        vendorName: fieldMappings.vendorName && row[fieldMappings.vendorName] !== undefined
          ? row[fieldMappings.vendorName]
          : (row['VendorName'] || currentFile.ocrDocument?.provider || ''),
        dataQuality: fieldMappings.dataQuality && row[fieldMappings.dataQuality] !== undefined
          ? row[fieldMappings.dataQuality]
          : defaultQuality
      }));

      const res = await confirmImport({
        fileId: currentFile.fileId,
        fileName: currentFile.fileName,
        category: selectedCategory,
        scope: selectedScope,
        mappedRecords,
        ocrDocument: currentFile.ocrDocument,
        isOcrParsed: currentFile.isOcrParsed
      });

      setImportStatus({
        success: true,
        importedCount: res.importedCount || 0,
        errorsCount: res.errorsCount || 0,
        errors: res.errors || [],
        duplicatesCount: res.duplicatesCount || 0,
        duplicates: res.duplicates || [],
        message: res.message
      });

      // Remove imported file from inspection queue
      const remaining = inspectedFiles.filter((_, idx) => idx !== activeFileIndex);
      setInspectedFiles(remaining);
      if (remaining.length > 0) {
        setActiveFileIndex(0);
        applyFileDefaults(remaining[0]);
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        importedCount: 0,
        errorsCount: 1,
        errors: [err.message || 'Import failed']
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to load realistic sample OCR bill for instant testing
  const handleLoadSampleOcrBill = async (type: 'tnb_electricity' | 'petronas_diesel' | 'gas_malaysia') => {
    setIsProcessing(true);
    setErrorMessage(null);
    setImportStatus(null);
    setOcrProgressMsg(`Extracting ${type === 'tnb_electricity' ? 'TNB Electricity Bill' : type === 'petronas_diesel' ? 'Petronas Fleet Fuel Receipt' : 'Gas Malaysia Statement'} with AI-assisted extraction...`);

    try {
      let dummyFile: File;
      if (type === 'tnb_electricity') {
        const content = `%PDF-1.4\n% Tenaga Nasional Berhad Commercial Bill\nNo Akaun: 220084920193\nTarikh Bil: 2024-11-20\nJumlah Perlu Dibayar: RM 6,420.50\nKegunaan Semasa: 14,250 kWh\nTarif B Perdagangan\n%%EOF`;
        dummyFile = new File([content], 'TNB_Electricity_Bill_Nov2024.pdf', { type: 'application/pdf' });
      } else if (type === 'petronas_diesel') {
        const content = `PETRONAS DAGANGAN BERHAD\nCOMMERCIAL FLEET RECEIPT\nRESIT NO: PET-849201\nTARIKH: 2024-11-15\nEURO 5 DIESEL\nLITER: 480.00 L\nJUMLAH: RM 1,416.00\nVEHICLE: BND 4819`;
        dummyFile = new File([content], 'Petronas_Commercial_Diesel_Nov2024.png', { type: 'image/png' });
      } else {
        const content = `%PDF-1.4\n% Gas Malaysia Energy Services Sdn Bhd\nAccount: GM-904812\nTarikh: 2024-11-18\nVolume: 850 m3\nJumlah: RM 3,272.50\nIndustrial Pipeline Gas\n%%EOF`;
        dummyFile = new File([content], 'Gas_Malaysia_Statement_Nov2024.pdf', { type: 'application/pdf' });
      }

      const parsedFiles = await inspectFiles([dummyFile]);
      setInspectedFiles(parsedFiles);
      if (parsedFiles.length > 0) {
        setActiveFileIndex(0);
        applyFileDefaults(parsedFiles[0]);
        setTimeout(() => {
          const el = document.getElementById('inspected-files-preview');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }
    } catch (err: any) {
      setErrorMessage(`Sample document could not be read: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setOcrProgressMsg('');
    }
  };

  // Download Sample Template
  const downloadTemplate = (type: 'electricity' | 'fuel' | 'bank_transactions' | 'financial_statements' | 'cash_budget') => {
    const csvData = generateSampleCsvContent(type);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sample_${type.toUpperCase()}_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="gb-documents-page">
      <div className="gb-page-heading gb-documents-heading">
        <div><h1>Data &amp; Documents</h1><p>Upload financial, energy and operational records to build your carbon baseline and financial analysis.</p></div>
        <div className="gb-header-actions">
          <details className="gb-document-templates"><summary className="gb-button"><Download size={14} /> Templates</summary>
            <div className="gb-document-template-menu">
              <button
                onClick={() => downloadTemplate('electricity')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between"
              >
                <span>Electricity Bills (kWh)</span>
                <span className="text-[10px] text-slate-400 font-mono">Scope 2</span>
              </button>
              <button
                onClick={() => downloadTemplate('fuel')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between"
              >
                <span>Fleet Diesel Logs (L)</span>
                <span className="text-[10px] text-slate-400 font-mono">Scope 1</span>
              </button>
              <button
                onClick={() => downloadTemplate('financial_statements')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between"
              >
                <span>Financial Input Template</span>
                <span className="text-[10px] text-emerald-700 font-mono font-bold">P&L / BS</span>
              </button>
              <button
                onClick={() => downloadTemplate('bank_transactions')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between"
              >
                <span>Bank Transactions</span>
                <span className="text-[10px] text-blue-700 font-mono font-bold">Cash Flow</span>
              </button>
            </div>
          </details>
          {pythonEngineStatus.connected && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '9999px',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#15803d',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Python FastAPI intake bridge ready at port 8000"
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
              Python Intake Pipeline Active
            </span>
          )}
          <button className="gb-button" onClick={loadSampleData} disabled={isProcessing || isLoading}>Load Sample Data</button>
        </div>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Upload Error: </span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="gb-document-categories">
        <article><Coins size={17} /><div><h2>Financial Records</h2><p>Statements, bank records and accounts.</p></div></article>
        <article><Zap size={17} /><div><h2>Energy &amp; Emissions Records</h2><p>Electricity bills, fuel and gas records.</p></div></article>
        <article><Building size={17} /><div><h2>Operational Records</h2><p>Equipment, production and operating hours.</p></div></article>
      </div>

      {/* Drag & Drop File Upload Area with OCR Support */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Browse documents to upload"
        onKeyDown={event => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault(); fileInputRef.current?.click();
          }
        }}
        className={`gb-document-dropzone border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-emerald-400 bg-white hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = ''; // Always reset so re-selecting same file works
            }
          }}
        />

        {isProcessing ? (
          <div className="py-2 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-900">
                {ocrProgressMsg || 'Reading your document...'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Checking the figures and dates in your document.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <UploadCloud className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-slate-900">
              Drop files here or <span className="text-emerald-600 underline">browse</span>
            </h3>

            <p className="text-xs text-slate-500 mt-1.5 max-w-lg mx-auto leading-relaxed">
              PDF, CSV, Excel and images supported. AI-assisted extraction is available for bills and statements.
            </p>
          </>
        )}

        {/* Inline Extracted Alert if a file is already parsed and waiting for confirmation */}
        {currentFile && !isProcessing && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              const el = document.getElementById('inspected-files-preview');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="my-3 p-3.5 bg-emerald-50/90 border-2 border-emerald-400 rounded-xl text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:bg-emerald-100/80 transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>Analyzed & Ready: {currentFile.fileName}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-200 text-emerald-900 font-mono font-bold uppercase">{currentFile.fileType}</span>
                </div>
                <div className="text-[11px] text-emerald-800">
                  {currentFile.isOcrParsed && currentFile.ocrDocument
                    ? `${currentFile.ocrDocument.documentType} • ${currentFile.ocrDocument.quantity.toLocaleString()} ${currentFile.ocrDocument.unit} • RM ${currentFile.ocrDocument.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : `${currentFile.sampleRows.length} record(s) parsed • Category: ${currentFile.detectedCategory}`}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 shadow-xs transition"
            >
              <span>Review Extracted Data Below</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Error Message if upload inspection failed */}
        {errorMessage && !isProcessing && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-3 p-3 bg-red-50 border border-red-200 rounded-xl text-left flex items-start justify-between gap-2 text-xs text-red-900"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">File Notice:</p>
                <p className="text-[11px]">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 font-semibold text-[11px] px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

      </div>

      {/* Import Feedback Banner */}
      {importStatus && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            importStatus.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start space-x-3">
            {importStatus.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                {importStatus.success
                  ? importStatus.importedCount > 0
                    ? `Successfully processed ${importStatus.importedCount} records.`
                    : (importStatus.message || 'Records processed safely.')
                  : 'Import validation failed'}
              </p>
              {importStatus.duplicatesCount && importStatus.duplicatesCount > 0 ? (
                <p className="text-xs text-amber-800 font-medium mt-0.5">
                  🛡️ {importStatus.duplicatesCount} duplicate record(s) were safely identified and skipped to prevent duplicate emissions.
                </p>
              ) : null}
              {importStatus.errors.length > 0 && (
                <ul className="text-xs mt-1.5 list-disc pl-4 space-y-0.5 text-slate-700">
                  {importStatus.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {importStatus.errors.length > 5 && (
                    <li>...and {importStatus.errors.length - 5} more flagged rows.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">

            {importStatus.success && (
              <>
                <button
                  onClick={() => setActiveTab('baseline')}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-2xs"
                >
                  Review Carbon Baseline →
                </button>
                <button
                  onClick={() => setActiveTab('financials')}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-2xs"
                >
                  Review Financial Impact →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Inspected Files Preview & Field Mapping Workflow */}
      {currentFile && (
        <div id="inspected-files-preview" className="bg-white border-2 border-emerald-500/50 rounded-2xl p-6 shadow-md space-y-6 scroll-mt-6 ring-4 ring-emerald-500/10">
          {/* Action Callout Banner */}
          <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>Review extracted data for "{currentFile.fileName}"</span>
            </div>
            <span className="text-emerald-100 font-normal">
              Check the details below, then confirm to add these records.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-slate-900">
                  {currentFile.isOcrParsed ? 'Review extracted data' : 'Map Columns'} for "{currentFile.fileName}"
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 uppercase">
                  {currentFile.fileType}
                </span>
                {currentFile.isOcrParsed && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Data extracted</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Size: {(currentFile.fileSize / 1024).toFixed(1)} KB • Detected {currentFile.headers.length} data points
              </p>
            </div>

            {/* If multiple files uploaded, show switcher tabs */}
            {inspectedFiles.length > 1 && (
              <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                {inspectedFiles.map((f, idx) => (
                  <button
                    key={f.fileId}
                    onClick={() => {
                      setActiveFileIndex(idx);
                      applyFileDefaults(f);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      activeFileIndex === idx
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    File #{idx + 1}: {f.fileName.slice(0, 15)}...
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI OCR EXTRACTION CARD (Visible for PDF & Image Documents) */}
          {currentFile.isOcrParsed && currentFile.ocrDocument && (
            <div className="bg-gradient-to-r from-emerald-50/70 via-slate-50 to-blue-50/50 border border-emerald-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {currentFile.ocrDocument.documentType}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Issued by <strong>{currentFile.ocrDocument.provider}</strong> • Account / Ref: <strong>{currentFile.ocrDocument.accountOrInvoiceNo}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-emerald-300 text-emerald-800 shadow-2xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{currentFile.ocrDocument.confidenceScore}% Confidence</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition flex items-center gap-1"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                    <span>{showAdvancedMapping ? 'Hide column mapping' : 'Adjust Mapping'}</span>
                  </button>
                </div>
              </div>

              {/* Extracted Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Billing Date / Period</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{currentFile.ocrDocument.billingPeriodOrDate}</div>
                  <div className="text-[10px] text-slate-500">Extracted invoice date</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Consumption Volume</div>
                  <div className="text-sm font-bold text-emerald-700 mt-0.5">
                    {currentFile.ocrDocument.quantity.toLocaleString()} {currentFile.ocrDocument.unit}
                  </div>
                  <div className="text-[10px] text-slate-500">{currentFile.ocrDocument.scope} Evidence</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Billed Outlay</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    RM {currentFile.ocrDocument.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500">Includes SST & Tariffs</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Calculated Emissions</div>
                  <div className="text-sm font-bold text-emerald-800 mt-0.5">
                    {currentFile.ocrDocument.calculatedEmissionsTCO2e || (
                      ((currentFile.ocrDocument.quantity * 0.584) / 1000).toFixed(2)
                    )} tCO2e
                  </div>
                  <div className="text-[10px] text-slate-500">Suruhanjaya Tenaga / DEFRA</div>
                </div>
              </div>

              {/* Evidence Text Snippet */}
              {currentFile.ocrDocument.evidenceTextSnippet && (
                <div className="bg-white/80 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Audit Trail Verification Snippet: </span>
                    <span className="font-mono text-slate-600">{currentFile.ocrDocument.evidenceTextSnippet}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Category & Scope Selector (Expandable or visible) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Organize Record Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const cat = e.target.value as ActivityCategory;
                  setSelectedCategory(cat);
                  if (cat === 'electricity') {
                    setSelectedScope('Scope 2');
                  } else if (cat.startsWith('fuel_') || cat === 'refrigerant') {
                    setSelectedScope('Scope 1');
                  } else {
                    setSelectedScope('Not Applicable');
                  }
                }}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium"
              >
                <optgroup label="Energy & Emissions Records (GHG Protocol)">
                  <option value="electricity">Purchased Electricity (kWh) — Scope 2</option>
                  <option value="fuel_diesel">Commercial Fleet Diesel (Liters) — Scope 1</option>
                  <option value="fuel_petrol">Motor Petrol (Liters) — Scope 1</option>
                  <option value="fuel_gas">Natural Gas Pipeline (m³) — Scope 1</option>
                  <option value="fuel_lpg">LPG Cylinder Gas (kg) — Scope 1</option>
                  <option value="water">Municipal Water (m³) — Utility Outlay</option>
                  <option value="refrigerant">Refrigerant Top-up (kg) — Scope 1</option>
                </optgroup>
                <optgroup label="Financial Records">
                  <option value="bank_transactions">Bank Statements & Transactions</option>
                  <option value="financial_revenue_opex">Revenue & Operating Expenses</option>
                  <option value="accounts_payable_receivable">Accounts Payable / Receivable</option>
                  <option value="financial_report">Financial Statements / P&L</option>
                </optgroup>
                <optgroup label="Operational Records">
                  <option value="production_volume">Production Volume / Output Units</option>
                  <option value="equipment_record">Equipment Specs & Asset Register</option>
                  <option value="operating_hours">Operating Hours & Shifts</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GHG Protocol Scope</label>
              <input
                type="text"
                disabled
                value={selectedScope}
                className="w-full text-xs bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-slate-600 font-bold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Data Quality Grade</label>
              <select
                value={defaultQuality}
                onChange={(e) => setDefaultQuality(e.target.value as DataQualityType)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
              >
                <option value="invoice_derived">Invoice Derived (Billed Utility Amount & kWh)</option>
                <option value="measured">Measured (Smart Meter / Sub-meter Reading)</option>
                <option value="estimated">Estimated (Calculated from Spend / Proxy)</option>
              </select>
            </div>
          </div>

          {/* Column Mapping Selectors (Shown if Advanced is open or if not OCR) */}
          {showAdvancedMapping && (
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Match File Columns to Standard Transition Schema
                </h4>
                <span className="text-[11px] text-slate-500">
                  Auto-suggested based on detected headers
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Date Column <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fieldMappings.date}
                    onChange={(e) => setFieldMappings({ ...fieldMappings, date: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {currentFile.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Quantity / Metric Column <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fieldMappings.quantity}
                    onChange={(e) => setFieldMappings({ ...fieldMappings, quantity: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {currentFile.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cost / Amount Column</label>
                  <select
                    value={fieldMappings.cost}
                    onChange={(e) => setFieldMappings({ ...fieldMappings, cost: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  >
                    <option value="">-- Optional / None --</option>
                    {currentFile.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Invoice / Receipt # Column</label>
                  <select
                    value={fieldMappings.invoiceNumber}
                    onChange={(e) => setFieldMappings({ ...fieldMappings, invoiceNumber: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  >
                    <option value="">-- Optional / None --</option>
                    {currentFile.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Raw Extracted Data Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Extracted Data Rows ({currentFile.sampleRows.length} item{currentFile.sampleRows.length !== 1 ? 's' : ''})
              </h4>
              <span className="text-[11px] text-slate-500">
                Inspect before confirming import into database
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-56">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    {currentFile.headers.map((h) => (
                      <th key={h} className="py-2 px-3 border-b border-slate-200">
                        {h}
                        {fieldMappings.date === h && <span className="ml-1 text-emerald-700 font-bold">(Date)</span>}
                        {fieldMappings.quantity === h && <span className="ml-1 text-blue-700 font-bold">(Qty)</span>}
                        {fieldMappings.cost === h && <span className="ml-1 text-amber-700 font-bold">(Cost)</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentFile.sampleRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {currentFile.headers.map((h) => (
                        <td key={h} className="py-2 px-3 font-mono text-[11px] text-slate-800">
                          {String(row[h] !== undefined ? row[h] : '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirmation & Import Action */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              onClick={() => {
                const remaining = inspectedFiles.filter((_, idx) => idx !== activeFileIndex);
                setInspectedFiles(remaining);
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard File</span>
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {currentFile.isOcrParsed
                  ? `Confirm document (${currentFile.sampleRows.length} record)`
                  : `Confirm records (${currentFile.sampleRows.length})`}
              </span>
            </button>
          </div>
        </div>
      )}

      <section className="gb-documents-registry" aria-labelledby="uploaded-documents-heading">
        <div className="gb-panel-heading"><h2 id="uploaded-documents-heading">Uploaded Documents</h2><span>{uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''}</span></div>
        <p>Uploaded records remain linked to their source documents for review and audit.</p>
        {!uploadedFiles.length ? <div className="gb-documents-empty">No documents yet. Upload files above or choose Load Sample Data.</div> : (
          <div className="gb-document-list"><table><thead><tr><th>Filename</th><th>Document type</th><th>Processing status</th><th>Confidence</th></tr></thead><tbody>
            {uploadedFiles.map(file => {
              const confidence = file.ocrDocument?.confidenceScore;
              const hasConfidence = typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 100;
              return <tr key={file.id}>
                <td><details className="gb-document-file"><summary>{file.fileName}</summary><p>{file.fileType.toUpperCase()} | {file.recordsImported} records | {new Date(file.uploadTimestamp).toLocaleString()}</p>{file.errors?.map((error, index) => <p key={index}>{error}</p>)}</details></td>
                <td>{file.ocrDocument?.documentType || documentLabels[file.detectedCategory] || 'Business document'}</td>
                <td><span className={`gb-document-status gb-document-status-${file.status}`}>{file.status === 'imported' ? <><CheckCircle2 size={13} /> Processed{file.recordsFlagged > 0 ? ' - review flagged records' : ''}</> : file.status === 'failed' ? <><AlertCircle size={13} /> Needs review</> : 'Awaiting review'}</span></td>
                <td>{hasConfidence ? `${confidence}% confidence` : 'Not available'}</td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>
      <div className="gb-documents-next">
        {importStatus && <div>            <button
              onClick={handleReturnToOrigin}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-xs font-semibold text-slate-700 transition"
            >
              {returnSourceSection === 'activity_evidence' ? '← Back to Evidence Card' : '← Back to Overview'}
            </button></div>}
        <button className="gb-button gb-primary" onClick={() => setActiveTab('baseline')}>Review Carbon Analysis <ArrowRight size={15} /></button>
      </div>
    </div>
  );
};
