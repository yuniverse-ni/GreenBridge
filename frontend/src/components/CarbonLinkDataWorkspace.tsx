import React, { useState } from 'react';
import { FileText, UploadCloud, CheckCircle2, AlertTriangle, RefreshCw, ChartBar, ShieldCheck } from 'lucide-react';

const SOURCE_OPTIONS = [
  'Electricity consumption',
  'Purchased electricity bills and tariff details',
  'Diesel, petrol, natural gas, LPG and fuel use',
  'Company-owned vehicle fuel',
  'Refrigerant top-ups or leakage',
  'Purchased materials and manufacturing inputs',
  'Purchased goods and services',
  'Inbound and outbound transportation',
  'Business travel',
  'Employee commuting',
  'Waste generation and treatment',
  'Water consumption',
  'Production volume',
  'Revenue and operating expenses',
  'Other operational records'
];

export const CarbonLinkDataWorkspace: React.FC = () => {
  const [fileName, setFileName] = useState('sample_utility_bill.pdf');
  const [status, setStatus] = useState('Review required');
  const [sourceCategory, setSourceCategory] = useState('Electricity consumption');
  const [reportingPeriod, setReportingPeriod] = useState('2024');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    setIsUploading(true);
    setStatus('Processing');
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStatus('Approved');
    setIsUploading(false);
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-semibold">CarbonLink</p>
          <h2 className="text-2xl font-bold text-slate-900">Data + Carbon Workspace</h2>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          Traceable intake
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <UploadCloud className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-slate-800">Upload files</span>
            </div>
            <button
              type="button"
              onClick={handleUpload}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-3 py-2 text-sm font-semibold hover:bg-emerald-700"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {isUploading ? 'Processing...' : 'Process'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-slate-800">{fileName}</span>
              <span className="text-xs bg-slate-100 px-2 py-1 rounded">PDF</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>Size: 1.2 MB</div>
              <div>Status: {status}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-700">Source category</label>
            <select
              value={sourceCategory}
              onChange={(e) => setSourceCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <label className="block text-xs font-medium text-slate-700">Reporting period</label>
            <input
              value={reportingPeriod}
              onChange={(e) => setReportingPeriod(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
              <FileText className="w-4 h-4 text-emerald-600" />
              Extraction result
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex justify-between"><span>Supplier</span><strong>TNB</strong></div>
              <div className="flex justify-between"><span>Consumption</span><strong>8,450 kWh</strong></div>
              <div className="flex justify-between"><span>Bill amount</span><strong>RM 4,200</strong></div>
              <div className="flex justify-between"><span>Confidence</span><strong>86%</strong></div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
              <ChartBar className="w-4 h-4 text-emerald-600" />
              Baseline readiness
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Scope 2 emissions</span>
              <span className="text-xl font-bold text-slate-900">4.93 tCO₂e</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              Review invoice period alignment before approval.
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-800 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              Validation summary
            </div>
            <ul className="text-sm text-emerald-900 space-y-1">
              <li>• Document parsed successfully</li>
              <li>• Required fields present</li>
              <li>• Duplicate check passed</li>
              <li>• Emission factor available</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
