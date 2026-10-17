// TransitionAI — Carbon Accounting Engine (Scope 1 & Scope 2)
import React, { useState } from 'react';
import { useTransition } from '../context/TransitionContext';
import { DOCUMENTED_EMISSION_FACTORS } from '../utils/carbonFactors';
import {
  Leaf,
  Layers,
  HelpCircle,
  FileText,
  BarChart2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Download
} from 'lucide-react';
import { formatCurrency } from '../utils/transitionCalculations';

export const CarbonAccountingView: React.FC = () => {
  const { baseline, profile, activityRecords, updateProfile } = useTransition();

  const [filterScope, setFilterScope] = useState<'all' | 'Scope 1' | 'Scope 2'>('all');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  const filteredRecords = activityRecords.filter((r) => {
    if (filterScope === 'all') return true;
    return r.scope === filterScope;
  });

  return (
    <div className="space-y-6">
      {/* Top Overview Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Scope 1 & Scope 2 Carbon Accounting Engine</h1>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              GHG Protocol Aligned
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Calculated strictly from verified activity records using documented emission factors (DEFRA 2024, Suruhanjaya Tenaga 2023, IPCC). Zero fabricated numbers.
          </p>
        </div>

        {/* Region & Factor Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-600">Grid Region:</label>
          <select
            value={profile.gridRegion || 'Peninsular Malaysia'}
            onChange={(e) => updateProfile({ gridRegion: e.target.value })}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
          >
            <option value="Peninsular Malaysia">Peninsular Malaysia (0.584 kg/kWh)</option>
            <option value="Sabah / Sarawak">Sabah / Sarawak (0.428 kg/kWh)</option>
            <option value="United Kingdom">United Kingdom (0.207 kg/kWh)</option>
            <option value="United States">United States Average (0.386 kg/kWh)</option>
            <option value="European Union">European Union (0.245 kg/kWh)</option>
          </select>
        </div>
      </div>

      {/* Scope 1 vs Scope 2 Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Footprint */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Carbon Footprint</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white">{baseline.totalTCO2e}</span>
            <span className="text-xs text-slate-400 ml-2 font-medium">tCO₂e</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Reporting Period: Calendar Year {profile.reportingYear}
          </p>
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-medium">Data Confidence:</span>
            <span className="font-bold">{baseline.dataConfidence.overallScorePct}% ({baseline.dataConfidence.level})</span>
          </div>
        </div>

        {/* Scope 1 Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Scope 1 (Direct Fuel Combustion)</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
              Direct
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900">{baseline.scope1TCO2e}</span>
            <span className="text-xs text-slate-500 ml-2 font-medium">tCO₂e</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Fleet diesel, petrol, industrial pipeline natural gas, standby generator fuel.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Share of Total:</span>
            <strong className="text-slate-900">
              {baseline.totalTCO2e > 0 ? ((baseline.scope1TCO2e / baseline.totalTCO2e) * 100).toFixed(1) : 0}%
            </strong>
          </div>
        </div>

        {/* Scope 2 Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Scope 2 (Purchased Electricity)</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
              Indirect
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900">{baseline.scope2TCO2e}</span>
            <span className="text-xs text-slate-500 ml-2 font-medium">tCO₂e</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Factory machinery, HVAC, lighting, air compressors from power grid.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Share of Total:</span>
            <strong className="text-slate-900">
              {baseline.totalTCO2e > 0 ? ((baseline.scope2TCO2e / baseline.totalTCO2e) * 100).toFixed(1) : 0}%
            </strong>
          </div>
        </div>
      </div>

      {/* Carbon Intensity Benchmarks & Quality Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Intensity Metrics */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Carbon Intensity Benchmark Indicators</h3>
          <p className="text-xs text-slate-500 mb-4">
            Normalized against business activity for lender comparison across sector peers.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Revenue Intensity</span>
                <span className="text-[11px] text-slate-500">tCO₂e per RM 1,000,000 Revenue</span>
              </div>
              <span className="text-base font-extrabold text-slate-900">
                {baseline.intensityMetrics.tco2ePerMillionRevenue}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Employee Intensity</span>
                <span className="text-[11px] text-slate-500">tCO₂e per Full-Time Employee</span>
              </div>
              <span className="text-base font-extrabold text-slate-900">
                {baseline.intensityMetrics.tco2ePerEmployee}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Facility Area Intensity</span>
                <span className="text-[11px] text-slate-500">kgCO₂e per m² Floor Area</span>
              </div>
              <span className="text-base font-extrabold text-slate-900">
                {baseline.intensityMetrics.kgco2ePerSqMFloorArea}
              </span>
            </div>
          </div>
        </div>

        {/* Data Quality & Audit Confidence */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Audit Trail & Evidence Confidence</h3>
          <p className="text-xs text-slate-500 mb-4">
            Quality tier hierarchy based on ISO 14064-1 and GHG Protocol audit guidelines.
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Measured / Sub-Metered (Highest Grade)</span>
                <span>{baseline.dataConfidence.measuredPct}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${baseline.dataConfidence.measuredPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Invoice-Derived (Utility Statements)</span>
                <span>{baseline.dataConfidence.invoiceDerivedPct}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${baseline.dataConfidence.invoiceDerivedPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Estimated from Expenditure / Proxy</span>
                <span>{baseline.dataConfidence.estimatedPct + baseline.dataConfidence.proxyPct}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${baseline.dataConfidence.estimatedPct + baseline.dataConfidence.proxyPct}%` }} />
              </div>
            </div>
          </div>

          {baseline.dataConfidence.recommendations.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <span className="font-bold block mb-1">Auditor Recommendations to Reach 90%+ Confidence:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {baseline.dataConfidence.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Activity by Fuel & Energy Source Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1">Emissions by Activity Category</h3>
        <p className="text-xs text-slate-500 mb-4">
          Detailed breakdown of all energy streams, activity volumes, expenditure, and carbon impact.
        </p>

        {baseline.emissionsByFuel.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No energy activity records recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Energy Stream / Fuel</th>
                  <th className="py-2.5 px-3">Scope</th>
                  <th className="py-2.5 px-3">Total Activity Quantity</th>
                  <th className="py-2.5 px-3">Total Spend</th>
                  <th className="py-2.5 px-3">Emissions (tCO₂e)</th>
                  <th className="py-2.5 px-3">% of Footprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baseline.emissionsByFuel.map((fuel) => (
                  <tr key={fuel.category} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{fuel.name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        fuel.scope === 'Scope 2' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {fuel.scope}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">{fuel.quantity.toLocaleString()} {fuel.unit}</td>
                    <td className="py-2.5 px-3 font-mono">{formatCurrency(fuel.cost, profile.currency)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{fuel.emissionsTCO2e} t</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${fuel.percentage}%` }} />
                        </div>
                        <span className="font-semibold text-slate-700">{fuel.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auditable Activity Records Detail Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Activity Records Traceability Ledger</h3>
            <p className="text-xs text-slate-500">
              Each row documents the date, applied factor, calculation formula, and source evidence.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Filter Scope:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setFilterScope('all')}
                className={`px-2 py-1 rounded ${filterScope === 'all' ? 'bg-white shadow-xs font-semibold' : 'text-slate-600'}`}
              >
                All ({activityRecords.length})
              </button>
              <button
                onClick={() => setFilterScope('Scope 1')}
                className={`px-2 py-1 rounded ${filterScope === 'Scope 1' ? 'bg-white shadow-xs font-semibold' : 'text-slate-600'}`}
              >
                Scope 1
              </button>
              <button
                onClick={() => setFilterScope('Scope 2')}
                className={`px-2 py-1 rounded ${filterScope === 'Scope 2' ? 'bg-white shadow-xs font-semibold' : 'text-slate-600'}`}
              >
                Scope 2
              </button>
            </div>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No records match the selected scope filter.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 mt-4">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Scope / Category</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Emission Factor & Source</th>
                  <th className="py-2.5 px-3">Calculation Formula</th>
                  <th className="py-2.5 px-3">Emissions</th>
                  <th className="py-2.5 px-3">Evidence File / Invoice #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">{r.date}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.scope === 'Scope 2' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {r.scope} • {r.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">
                      {r.quantity.toLocaleString()} {r.unit}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-600">
                      <div className="font-mono">{r.emissionFactor} kgCO₂e/{r.unit}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{r.factorSource}</div>
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                      {r.quantity} × {r.emissionFactor} ÷ 1,000
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {r.emissionsTCO2e} tCO₂e
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500 truncate max-w-[160px]">
                      {r.sourceFileName || r.invoiceNumber || 'Manual Entry'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documented Emission Factors Reference Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1">Documented Emission Factors Reference Library</h3>
        <p className="text-xs text-slate-500 mb-4">
          All carbon factors are audited and sourced from official national agencies and IPCC guidelines.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Fuel / Activity</th>
                <th className="py-2.5 px-3">Scope</th>
                <th className="py-2.5 px-3">Factor Value</th>
                <th className="py-2.5 px-3">Source Institution</th>
                <th className="py-2.5 px-3">Jurisdiction</th>
                <th className="py-2.5 px-3">Accounting Methodology</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DOCUMENTED_EMISSION_FACTORS.map((f, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{f.name}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      f.scope === 'Scope 2' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {f.scope}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                    {f.factorKgCO2e} kgCO₂e / {f.unit}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{f.source}</td>
                  <td className="py-2.5 px-3 text-slate-500">{f.region}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
