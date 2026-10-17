import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { UploadPreviewBatch, ColumnMappingConfig } from '../types/finance';
import { formatMYR, parseMYRToSen } from '../utils/financeCalculations';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Building,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Info,
  Trash2,
  FileText,
  ShieldCheck,
  Calendar,
  Layers,
  Clock,
  Eye
} from 'lucide-react';
import {
  SAMPLE_INVOICES_TEMPLATE_CSV,
  SAMPLE_BILLS_TEMPLATE_CSV,
  SAMPLE_BANK_TEMPLATE_CSV
} from '../data/seedData';

export const DataSetupView: React.FC = () => {
  const {
    businessProfile,
    invoices,
    bills,
    bankTransactions,
    uploadedFiles,
    isDataLoaded,
    refreshData,
    clearAllData,
    updateSettings,
    setActiveTab,
    forecastHorizonDays,
    setForecastHorizonDays
  } = useFinance();

  const [wizardStep, setWizardStep] = useState<'upload' | 'mapping' | 'preview' | 'completed'>('upload');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewBatches, setPreviewBatches] = useState<UploadPreviewBatch[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);

  // Business Profile Settings Form
  const [bizName, setBizName] = useState(businessProfile.name || '');
  const [currency, setCurrency] = useState(businessProfile.currency || 'MYR');
  const [initialCashRM, setInitialCashRM] = useState((businessProfile.initialCashSen / 100).toString());
  const [minReserveRM, setMinReserveRM] = useState((businessProfile.minReserveSen / 100).toString());
  const [selectedHorizon, setSelectedHorizon] = useState(forecastHorizonDays.toString());

  // Import Results
  const [importSummary, setImportSummary] = useState<{
    invoicesCount: number;
    billsCount: number;
    transactionsCount: number;
    errors: { file: string; row: number; issue: string; recordData: any }[];
  } | null>(null);

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // Upload and inspect files on backend
  const handleInspectFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);

    const formData = new FormData();
    for (const f of selectedFiles) {
      formData.append('files', f);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Upload inspection failed.');
        setIsUploading(false);
        return;
      }

      setPreviewBatches(data.previewBatches || []);
      setActiveBatchIndex(0);
      setWizardStep('mapping');
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Update mapping for active batch
  const handleMappingChange = (field: keyof ColumnMappingConfig, column: string) => {
    setPreviewBatches((prev) => {
      const updated = [...prev];
      const cur = updated[activeBatchIndex];
      if (cur) {
        cur.suggestedMapping[field] = column;
      }
      return updated;
    });
  };

  // Update detected category for active batch
  const handleCategoryChange = (category: 'invoices' | 'bills' | 'transactions') => {
    setPreviewBatches((prev) => {
      const updated = [...prev];
      const cur = updated[activeBatchIndex];
      if (cur) {
        cur.detectedCategory = category;
      }
      return updated;
    });
  };

  // Final confirm and save to server
  const handleConfirmImport = async () => {
    setIsUploading(true);
    try {
      const payloadBatches = previewBatches.map((b) => ({
        fileName: b.fileName,
        category: b.detectedCategory,
        rows: b.rawRows,
        mapping: b.suggestedMapping
      }));

      const profileUpdates = {
        name: bizName || businessProfile.name || 'My Company',
        currency,
        initialCashSen: parseMYRToSen(initialCashRM),
        minReserveSen: parseMYRToSen(minReserveRM),
        forecastHorizonDays: Number(selectedHorizon) || 30
      };

      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batches: payloadBatches, profileUpdates })
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Import failed.');
        setIsUploading(false);
        return;
      }

      setImportSummary({
        invoicesCount: result.imported.invoicesCount,
        billsCount: result.imported.billsCount,
        transactionsCount: result.imported.transactionsCount,
        errors: result.errors || []
      });

      await refreshData();
      setWizardStep('completed');
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Download error report for rejected rows
  const handleDownloadErrors = () => {
    if (!importSummary || importSummary.errors.length === 0) return;
    const lines = [
      'File,Row_Index,Issue_Description,Record_Snapshot',
      ...importSummary.errors.map(
        (e) => `"${e.file}",${e.row},"${e.issue}","${JSON.stringify(e.recordData).replace(/"/g, '""')}"`
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CashPilot_Import_Errors_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download sample reference templates
  const downloadSampleTemplate = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeBatch = previewBatches[activeBatchIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Financial Data Ingestion & Setup
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-medium">
              Multi-File Parser (CSV, Excel, PDF)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Upload your actual business records to generate data-driven cash forecasts and risk alerts.
          </p>
        </div>

        {isDataLoaded && (
          <div className="flex items-center space-x-2 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={clearAllData}
              className="px-3 py-2 text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
              title="Delete all imported financial records from the secure server"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Data</span>
            </button>
          </div>
        )}
      </div>

      {/* Sensitive Data Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900 font-semibold block">Data Privacy & Security Guarantee:</strong>
          Financial files are parsed directly by CashPilot’s backend. Your actual transaction records remain isolated, deterministic calculations run locally, and no sensitive customer records are exposed.
        </div>
      </div>

      {/* Step Progress Wizard */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-center space-x-2 sm:space-x-8 text-xs font-semibold overflow-x-auto">
          <div className={`flex items-center space-x-2 ${wizardStep === 'upload' ? 'text-teal-800' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              wizardStep === 'upload' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}>1</span>
            <span>Select Files</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center space-x-2 ${wizardStep === 'mapping' ? 'text-teal-800' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              wizardStep === 'mapping' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}>2</span>
            <span>Map Columns</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center space-x-2 ${wizardStep === 'preview' ? 'text-teal-800' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              wizardStep === 'preview' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}>3</span>
            <span>Validate & Confirm</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center space-x-2 ${wizardStep === 'completed' ? 'text-emerald-800' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              wizardStep === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>4</span>
            <span>Ready</span>
          </div>
        </div>
      </div>

      {/* Wizard Step 1: Upload Files */}
      {wizardStep === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Upload Box */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                1. Select Financial Records
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Upload your bank statement files, customer invoices, and vendor bills. You can upload multiple files simultaneously.
              </p>
            </div>

            {/* Drag & Drop Zone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-2xl p-8 text-center cursor-pointer transition relative bg-slate-50/50">
              <input
                type="file"
                multiple
                accept=".csv, .xlsx, .xls, .pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 text-teal-700 mx-auto" />
              <p className="text-sm font-semibold text-slate-800 mt-3">
                Click to browse or drop financial files here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supported formats: <strong>CSV</strong>, <strong>Excel (.xlsx, .xls)</strong>, and <strong>PDF</strong> statements
              </p>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Files Selected ({selectedFiles.length}):
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                        <span className="font-semibold text-slate-800">{file.name}</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {file.name.split('.').pop()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleInspectFiles}
                disabled={selectedFiles.length === 0 || isUploading}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition disabled:opacity-50 flex items-center space-x-2"
              >
                <span>{isUploading ? 'Inspecting Files...' : 'Inspect & Map Columns'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Reference Box & Blank Templates */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm">
              Standard Format Guide
            </h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              CashPilot’s smart parser detects custom column names automatically. If you're building a spreadsheet from scratch, download these clean starter templates:
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => downloadSampleTemplate('invoices_template.csv', SAMPLE_INVOICES_TEMPLATE_CSV)}
                className="w-full p-2.5 text-left border border-slate-200 hover:border-teal-500 rounded-xl flex items-center justify-between transition group"
              >
                <div>
                  <span className="font-semibold text-slate-800 block">Customer Invoices (.csv)</span>
                  <span className="text-[10px] text-slate-400">ID, Customer, Amount, Due Date</span>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-teal-700" />
              </button>

              <button
                onClick={() => downloadSampleTemplate('bills_template.csv', SAMPLE_BILLS_TEMPLATE_CSV)}
                className="w-full p-2.5 text-left border border-slate-200 hover:border-teal-500 rounded-xl flex items-center justify-between transition group"
              >
                <div>
                  <span className="font-semibold text-slate-800 block">Supplier Bills (.csv)</span>
                  <span className="text-[10px] text-slate-400">ID, Vendor, Category, Amount, Due Date</span>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-teal-700" />
              </button>

              <button
                onClick={() => downloadSampleTemplate('bank_template.csv', SAMPLE_BANK_TEMPLATE_CSV)}
                className="w-full p-2.5 text-left border border-slate-200 hover:border-teal-500 rounded-xl flex items-center justify-between transition group"
              >
                <div>
                  <span className="font-semibold text-slate-800 block">Bank Statement (.csv)</span>
                  <span className="text-[10px] text-slate-400">Date, Description, Type, Amount</span>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-teal-700" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wizard Step 2: Column Mapping */}
      {wizardStep === 'mapping' && activeBatch && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-semibold text-slate-500">File {activeBatchIndex + 1} of {previewBatches.length}:</span>
                <span className="font-bold text-slate-900 text-sm sm:text-base">{activeBatch.fileName}</span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                  {activeBatch.totalRows} records detected
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Confirm what type of financial data this file contains and map columns to standard financial fields.
              </p>
            </div>

            {/* Multi-file batch switcher */}
            {previewBatches.length > 1 && (
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
                {previewBatches.map((b, i) => (
                  <button
                    key={b.fileId}
                    onClick={() => setActiveBatchIndex(i)}
                    className={`px-3 py-1 rounded font-medium transition ${
                      activeBatchIndex === i ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    File {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Financial Record Category:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label
                onClick={() => handleCategoryChange('invoices')}
                className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2 transition ${
                  activeBatch.detectedCategory === 'invoices'
                    ? 'border-teal-700 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="cat"
                  checked={activeBatch.detectedCategory === 'invoices'}
                  onChange={() => handleCategoryChange('invoices')}
                  className="accent-teal-700"
                />
                <span>Customer Invoices (Receivables)</span>
              </label>

              <label
                onClick={() => handleCategoryChange('bills')}
                className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2 transition ${
                  activeBatch.detectedCategory === 'bills'
                    ? 'border-teal-700 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="cat"
                  checked={activeBatch.detectedCategory === 'bills'}
                  onChange={() => handleCategoryChange('bills')}
                  className="accent-teal-700"
                />
                <span>Supplier Bills (Payables)</span>
              </label>

              <label
                onClick={() => handleCategoryChange('transactions')}
                className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2 transition ${
                  activeBatch.detectedCategory === 'transactions'
                    ? 'border-teal-700 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="cat"
                  checked={activeBatch.detectedCategory === 'transactions'}
                  onChange={() => handleCategoryChange('transactions')}
                  className="accent-teal-700"
                />
                <span>Bank Statement / Transactions</span>
              </label>
            </div>
          </div>

          {/* Column Mapping Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Record ID / Reference:
              </label>
              <select
                value={activeBatch.suggestedMapping.idColumn}
                onChange={(e) => handleMappingChange('idColumn', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- Auto-generate ID --</option>
                {activeBatch.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Entity / Customer / Vendor:
              </label>
              <select
                value={activeBatch.suggestedMapping.entityColumn}
                onChange={(e) => handleMappingChange('entityColumn', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="">-- Select Column --</option>
                {activeBatch.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Amount (RM): <span className="text-rose-600">*</span>
              </label>
              <select
                value={activeBatch.suggestedMapping.amountColumn}
                onChange={(e) => handleMappingChange('amountColumn', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
              >
                <option value="">-- Select Column --</option>
                {activeBatch.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Due Date / Maturity:
              </label>
              <select
                value={activeBatch.suggestedMapping.dueDateColumn}
                onChange={(e) => handleMappingChange('dueDateColumn', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- Select Column --</option>
                {activeBatch.headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Raw Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-semibold text-slate-800">
                Data Preview (First 5 Rows):
              </span>
              <span className="text-slate-400">Inspecting extracted spreadsheet fields</span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    {activeBatch.headers.map((h) => (
                      <th key={h} className="py-2 px-3 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {activeBatch.rawRows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {activeBatch.headers.map((h) => (
                        <td key={h} className="py-2 px-3 text-slate-700 whitespace-nowrap">
                          {String(row[h] !== undefined ? row[h] : '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setWizardStep('upload')}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              ← Back to File Selection
            </button>

            <button
              onClick={() => setWizardStep('preview')}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center space-x-1.5"
            >
              <span>Review & Validate Records</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Wizard Step 3: Validate & Configure Cash Parameters */}
      {wizardStep === 'preview' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              3. Set Cash Parameters & Confirm Import
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Provide your opening cleared cash position and minimum safety reserve target to activate deterministic forecasting.
            </p>
          </div>

          {/* Financial Profile Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Company / Business Name:</label>
              <input
                type="text"
                placeholder="e.g. Apex Engineering Sdn Bhd"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Current Cleared Cash (RM):</label>
              <input
                type="number"
                placeholder="0.00"
                value={initialCashRM}
                onChange={(e) => setInitialCashRM(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Minimum Safety Reserve (RM):</label>
              <input
                type="number"
                placeholder="0.00"
                value={minReserveRM}
                onChange={(e) => setMinReserveRM(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Forecast Horizon:</label>
              <select
                value={selectedHorizon}
                onChange={(e) => setSelectedHorizon(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days (Standard)</option>
                <option value="90">90 Days (Quarterly)</option>
              </select>
            </div>
          </div>

          {/* Files Ready for Import Summary */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-800 block">
              Files to be imported into server database:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {previewBatches.map((b, i) => (
                <div key={b.fileId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 truncate">{b.fileName}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 uppercase">
                      {b.detectedCategory}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {b.totalRows} raw records parsed
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final Import CTA */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setWizardStep('mapping')}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              ← Back to Column Mapping
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={isUploading}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition disabled:opacity-50 flex items-center space-x-2"
            >
              <span>{isUploading ? 'Validating & Importing...' : 'Confirm & Ingest Data'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Wizard Step 4: Import Complete Summary */}
      {wizardStep === 'completed' && importSummary && (
        <div className="bg-white rounded-2xl border border-emerald-300 p-8 shadow-xs text-center max-w-xl mx-auto space-y-5">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Financial Data Successfully Imported
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Your records have been validated and saved to the secure backend store.
            </p>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoices</span>
              <span className="font-mono font-bold text-slate-900 text-base">{importSummary.invoicesCount}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bills</span>
              <span className="font-mono font-bold text-slate-900 text-base">{importSummary.billsCount}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Transactions</span>
              <span className="font-mono font-bold text-slate-900 text-base">{importSummary.transactionsCount}</span>
            </div>
          </div>

          {/* Error Details if any */}
          {importSummary.errors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>{importSummary.errors.length} Invalid / Conflicting Row(s) Flagged</span>
                </span>
                <button
                  onClick={handleDownloadErrors}
                  className="text-teal-800 font-semibold underline text-[11px] flex items-center space-x-0.5"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Error Report (.csv)</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-700">
                Invalid records were not silently discarded. You can review and correct them using the downloaded report.
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-center space-x-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition"
            >
              Open Command Center
            </button>
            <button
              onClick={() => setWizardStep('upload')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              Upload More Files
            </button>
          </div>
        </div>
      )}

      {/* Existing Uploaded Records Table & Manager */}
      {isDataLoaded && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Active Imported Records ({invoices.length} Invoices, {bills.length} Bills)
              </h3>
              <p className="text-xs text-slate-500">
                All numbers on the dashboard are computed strictly from these verified records.
              </p>
            </div>
            <button
              onClick={() => setWizardStep('upload')}
              className="text-xs text-teal-800 font-semibold hover:underline"
            >
              + Ingest Additional Records
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Invoices list */}
            <div>
              <span className="font-semibold text-slate-800 block mb-2">
                Accounts Receivable ({invoices.length}):
              </span>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {invoices.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">No invoices uploaded yet.</div>
                ) : (
                  invoices.map((inv) => (
                    <div key={inv.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">{inv.customerName}</span>
                        <span className="text-slate-400 font-mono text-[11px] ml-1.5">({inv.id})</span>
                        <div className="text-[10px] text-slate-500">Due: {inv.dueDate}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-700">+{formatMYR(inv.amountSen)}</div>
                        <span className={`text-[10px] px-1.5 rounded font-semibold ${
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : inv.daysOverdue > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {inv.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bills list */}
            <div>
              <span className="font-semibold text-slate-800 block mb-2">
                Accounts Payable ({bills.length}):
              </span>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {bills.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">No bills uploaded yet.</div>
                ) : (
                  bills.map((bill) => (
                    <div key={bill.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">{bill.vendorName}</span>
                        <span className="text-slate-400 font-mono text-[11px] ml-1.5">({bill.id})</span>
                        <div className="text-[10px] text-slate-500">Due: {bill.dueDate} (Day {bill.dueDayOffset})</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-rose-700">-{formatMYR(bill.amountSen)}</div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded font-medium">
                          {bill.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
