// TransitionAI — Audit Trail & Evidence Registry
import { readDisclosureAudit } from '../agentData/lenderDrafts';
import React, { useState } from 'react';
import { useTransition } from '../context/TransitionContext';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Lock,
  Layers,
  FileSpreadsheet,
  Download
} from 'lucide-react';

export const AuditEvidenceView: React.FC = () => {
  const { auditLogs, uploadedFiles, profile, activityRecords } = useTransition();

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [recordScope, setRecordScope] = useState('all');

  const filteredLogs = [...readDisclosureAudit(profile.id), ...auditLogs].filter((log) => {
    if (filterCategory === 'all') return true;
    return log.category === filterCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Audit Trail & Evidence Registry</h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              Immutable Governance Log
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Every file ingestion, carbon emission factor lookup, financial debt calculation, and lender package disclosure is recorded with an immutable audit hash.
          </p>
        </div>

        <div className="text-right px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Audited Events</span>
          <span className="text-base font-extrabold text-slate-900">{auditLogs.length} Events</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 bg-white border border-slate-200 p-2 rounded-xl text-xs font-medium">
        <span className="text-slate-500 px-2 font-bold uppercase text-[10px]">Filter:</span>
        {['all', 'DATA_INGESTION', 'PLAN_AUTHORIZATION', 'LENDER_DISCLOSURE'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterCategory === cat
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Audit Log Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 mb-2">Chronological Governance Ledger</h3>

        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No audit logs recorded for this category yet.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition bg-slate-50/50 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{log.action}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                        {log.category}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        by {log.userRole.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{log.details}</p>
                    {log.evidenceRef && (
                      <span className="inline-block mt-1 font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Evidence Ref: {log.evidenceRef}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-[10px] text-slate-400 block">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{log.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source Files Physical Evidence Registry */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1">Source Ingestion Artifacts</h3>
        <p className="text-xs text-slate-500 mb-4">
          All financial figures, invoice numbers, and kilowatt-hour readings cite these verified original files.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-start justify-between">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 uppercase">
                  {file.fileType}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 mt-2 truncate">{file.fileName}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {file.recordsImported} Activity Records Extracted
              </p>
              <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-400 font-mono">
                Ingested: {new Date(file.uploadTimestamp).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
      <details className="gb-panel">
        <summary>Activity source records</summary>
        <label className="gb-grid-region">Scope
          <select value={recordScope} onChange={event => setRecordScope(event.target.value)}>
            <option value="all">All scopes</option><option value="Scope 1">Scope 1</option><option value="Scope 2">Scope 2</option>
          </select>
        </label>
        <div className="gb-table-scroll"><table><thead><tr><th>Date</th><th>Scope / Category</th><th>Quantity</th><th>Emission factor & source</th><th>Calculation</th><th>Emissions</th><th>Source document</th></tr></thead><tbody>
          {activityRecords.filter(record => recordScope === 'all' || record.scope === recordScope).map(record => <tr key={record.id}><td>{record.date}</td><td>{record.scope} / {record.category}</td><td>{record.quantity.toLocaleString()} {record.unit}</td><td>{record.emissionFactor} kgCO2e / {record.unit}<small>{record.factorSource}</small></td><td>{record.quantity} x {record.emissionFactor} / 1,000</td><td>{record.emissionsTCO2e} tCO2e</td><td>{record.sourceFileName || record.invoiceNumber || 'Manual entry'}</td></tr>)}
          {!activityRecords.some(record => recordScope === 'all' || record.scope === recordScope) && <tr><td colSpan={7}>No activity records for this scope.</td></tr>}
        </tbody></table></div>
      </details>
    </div>
  );
};
