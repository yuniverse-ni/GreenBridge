import React, { useState } from 'react';
import { CashProjectionPoint } from '../types/finance';
import { formatMYR, formatMYRShort } from '../utils/financeCalculations';
import { AlertTriangle, CheckCircle, Table, LineChart, HelpCircle } from 'lucide-react';

interface ForecastChartProps {
  points: CashProjectionPoint[];
  minReserveSen: number;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ points, minReserveSen }) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!points || points.length === 0) {
    return <div className="p-8 text-center text-slate-500">No forecast data available.</div>;
  }

  // Find min and max for chart scale
  const allBalances = points.map((p) => p.closingBalanceSen);
  const minVal = Math.min(...allBalances, 0, minReserveSen);
  const maxVal = Math.max(...allBalances, minReserveSen * 1.5, 3500000);

  // SVG dimensions
  const svgWidth = 840;
  const svgHeight = 280;
  const padding = { top: 25, right: 30, bottom: 40, left: 70 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Coordinate mappers
  const getY = (valSen: number) => {
    const ratio = (valSen - minVal) / (maxVal - minVal || 1);
    return padding.top + chartHeight - ratio * chartHeight;
  };

  const getX = (index: number) => {
    return padding.left + (index / (points.length - 1)) * chartWidth;
  };

  const zeroY = getY(0);
  const reserveY = getY(minReserveSen);

  // Generate SVG path for line
  const linePoints = points.map((p, idx) => `${getX(idx)},${getY(p.closingBalanceSen)}`).join(' ');
  const areaPath = `M ${getX(0)},${getY(points[0].closingBalanceSen)} ` +
    points.map((p, idx) => `L ${getX(idx)},${getY(p.closingBalanceSen)}`).join(' ') +
    ` L ${getX(points.length - 1)},${zeroY > padding.top + chartHeight ? padding.top + chartHeight : zeroY} L ${getX(0)},${zeroY > padding.top + chartHeight ? padding.top + chartHeight : zeroY} Z`;

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length > 12 ? 12 : 0];

  // Y-axis grid ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }).map((_, i) => {
    const val = minVal + (i / (tickCount - 1)) * (maxVal - minVal);
    return {
      valueSen: Math.round(val),
      y: getY(val)
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Chart Header with Controls */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
              30-Day Cash Liquidity Projection
            </h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              Deterministic Daily Model
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hover along timeline to inspect cash balance, daily inflows, and supplier outflows
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-2">
          <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center text-xs">
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'chart'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Chart</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Daily Table</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="p-4 sm:p-6">
          {/* Legend and Active Point Callout */}
          <div className="flex flex-wrap items-center justify-between text-xs gap-3 mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-1 bg-teal-600 rounded-sm" />
                <span className="text-slate-700 font-medium">Projected Balance</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500" />
                <span className="text-slate-700 font-medium">
                  Safety Reserve ({formatMYR(minReserveSen, false)})
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-700">Breach Zone (&lt; Reserve)</span>
              </div>
            </div>

            {/* Hovered Point Snapshot Card */}
            {hoveredPoint && (
              <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center space-x-3 text-xs">
                <span className="font-semibold text-slate-800">{hoveredPoint.dateString}:</span>
                <span className={`font-mono font-bold ${
                  hoveredPoint.closingBalanceSen < 0
                    ? 'text-rose-600'
                    : hoveredPoint.isBreach
                    ? 'text-amber-600'
                    : 'text-teal-700'
                }`}>
                  {formatMYR(hoveredPoint.closingBalanceSen)}
                </span>
                {hoveredPoint.isBreach ? (
                  <span className="text-[11px] text-rose-600 flex items-center space-x-1 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    <span>-{formatMYR(hoveredPoint.breachAmountSen)} under reserve</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-600 flex items-center space-x-1 font-medium">
                    <CheckCircle className="w-3 h-3" />
                    <span>Safe (+{formatMYR(hoveredPoint.closingBalanceSen - minReserveSen)} over reserve)</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* SVG Chart */}
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[650px] select-none"
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
                  <stop offset="70%" stopColor="#0d9488" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.15" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Ticks */}
              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={tick.y}
                    x2={svgWidth - padding.right}
                    y2={tick.y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padding.left - 10}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="text-[10px] fill-slate-400 font-mono"
                  >
                    {formatMYRShort(tick.valueSen)}
                  </text>
                </g>
              ))}

              {/* Zero Line */}
              {zeroY >= padding.top && zeroY <= padding.top + chartHeight && (
                <g>
                  <line
                    x1={padding.left}
                    y1={zeroY}
                    x2={svgWidth - padding.right}
                    y2={zeroY}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                  />
                  <text
                    x={svgWidth - padding.right + 5}
                    y={zeroY + 3}
                    className="text-[10px] fill-slate-500 font-medium"
                  >
                    RM 0 (Break-even)
                  </text>
                </g>
              )}

              {/* Minimum Reserve Threshold Line (RM 5,000) */}
              <g>
                <line
                  x1={padding.left}
                  y1={reserveY}
                  x2={svgWidth - padding.right}
                  y2={reserveY}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <text
                  x={svgWidth - padding.right + 5}
                  y={reserveY + 3}
                  className="text-[10px] fill-amber-700 font-semibold"
                >
                  Reserve ({formatMYRShort(minReserveSen)})
                </text>
              </g>

              {/* Area Fill */}
              <path d={areaPath} fill="url(#areaGrad)" />

              {/* Cash Projection Line */}
              <polyline
                fill="none"
                stroke="#0f766e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={linePoints}
              />

              {/* Data points */}
              {points.map((p, idx) => {
                const cx = getX(idx);
                const cy = getY(p.closingBalanceSen);
                const isSelected = hoveredIndex === idx;

                // Emphasize key days: Day 0, Day 10 (TechSupply), Day 12 (OfficeLease), Day 24, Day 30
                const isKeyDay = idx === 0 || idx === 5 || idx === 10 || idx === 12 || idx === 24 || idx === 30 || p.closingBalanceSen < 0;

                return (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    className="cursor-pointer"
                  >
                    {/* Invisible wider target for easy hover */}
                    <rect
                      x={cx - (chartWidth / points.length / 2)}
                      y={padding.top}
                      width={chartWidth / points.length}
                      height={chartHeight}
                      fill="transparent"
                    />

                    {/* Point Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : isKeyDay ? 4 : 2.5}
                      fill={p.closingBalanceSen < 0 ? '#e11d48' : p.isBreach ? '#f59e0b' : '#0d9488'}
                      stroke="#ffffff"
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      className="transition-all duration-150"
                    />

                    {/* X-axis labels for key days */}
                    {isKeyDay && (
                      <text
                        x={cx}
                        y={padding.top + chartHeight + 20}
                        textAnchor="middle"
                        className={`text-[10px] font-medium ${
                          isSelected ? 'fill-slate-900 font-bold' : 'fill-slate-500'
                        }`}
                      >
                        D{idx}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Vertical Guide when hovering */}
              {hoveredIndex !== null && (
                <line
                  x1={getX(hoveredIndex)}
                  y1={padding.top}
                  x2={getX(hoveredIndex)}
                  y2={padding.top + chartHeight}
                  stroke="#0f766e"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}
            </svg>
          </div>

          {/* Breakdown of transactions for the hovered point */}
          {hoveredPoint && (hoveredPoint.inflowDetails.length > 0 || hoveredPoint.outflowDetails.length > 0) && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs">
              <span className="text-slate-500 font-medium">Events on {hoveredPoint.dateString}:</span>
              {hoveredPoint.inflowDetails.map((inflow, i) => (
                <span key={i} className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  + {formatMYR(inflow.amountSen)}: {inflow.description}
                </span>
              ))}
              {hoveredPoint.outflowDetails.map((outflow, i) => (
                <span key={i} className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  - {formatMYR(outflow.amountSen)}: {outflow.description}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Daily Table View */
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Day / Date</th>
                <th className="py-2.5 px-4 font-semibold text-right">Opening</th>
                <th className="py-2.5 px-4 font-semibold text-right">Inflows</th>
                <th className="py-2.5 px-4 font-semibold text-right">Outflows</th>
                <th className="py-2.5 px-4 font-semibold text-right">Closing Balance</th>
                <th className="py-2.5 px-4 font-semibold">Safety Reserve Status</th>
                <th className="py-2.5 px-4 font-semibold">Scheduled Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {points.map((pt) => (
                <tr
                  key={pt.dayIndex}
                  className={`hover:bg-slate-50/80 transition ${
                    pt.closingBalanceSen < 0
                      ? 'bg-rose-50/40'
                      : pt.isBreach
                      ? 'bg-amber-50/30'
                      : ''
                  }`}
                >
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                    {pt.dateString}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-600">
                    {formatMYR(pt.openingBalanceSen)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-600">
                    {pt.projectedInflowsSen > 0 ? `+${formatMYR(pt.projectedInflowsSen)}` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right text-rose-600">
                    {pt.projectedOutflowsSen > 0 ? `-${formatMYR(pt.projectedOutflowsSen)}` : '—'}
                  </td>
                  <td className={`py-2.5 px-4 text-right font-bold ${
                    pt.closingBalanceSen < 0
                      ? 'text-rose-700'
                      : pt.isBreach
                      ? 'text-amber-700'
                      : 'text-teal-700'
                  }`}>
                    {formatMYR(pt.closingBalanceSen)}
                  </td>
                  <td className="py-2.5 px-4 font-sans">
                    {pt.closingBalanceSen < 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                        Deficit (-{formatMYR(pt.breachAmountSen)})
                      </span>
                    ) : pt.isBreach ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                        Breach (-{formatMYR(pt.breachAmountSen)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Safe
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-600 truncate max-w-xs">
                    {[
                      ...pt.inflowDetails.map((i) => i.description),
                      ...pt.outflowDetails.map((o) => o.description)
                    ].join(', ') || 'No scheduled cash movements'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
