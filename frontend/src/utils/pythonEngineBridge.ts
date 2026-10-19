// TransitionAI — Python FastAPI Financial & Decarbonisation Engine Bridge
// Connects the frontend directly to the deterministic Python backend on port 8000
// Provides statement computation, ratio diagnostics, and automated data ingestion

import {
  BusinessProfile,
  StoredFinancialModel,
  RatioValue
} from '../types/transition';

export const DEFAULT_PYTHON_BACKEND_URL = 'http://127.0.0.1:8000';

export interface PythonEngineStatus {
  connected: boolean;
  checking: boolean;
  backendUrl: string;
  version?: string;
  lastChecked?: string;
  error?: string;
}

export interface PythonEngineComputationResult {
  success: boolean;
  model?: StoredFinancialModel;
  raw?: any;
  error?: string;
  auditHash?: string;
}

/**
 * Checks connectivity with the Python FastAPI backend on port 8000.
 * Falls back to Express proxy `/api/transition/py-status` if direct access is blocked.
 */
export async function checkPythonEngineHealth(customUrl?: string): Promise<PythonEngineStatus> {
  const targetUrl = customUrl || DEFAULT_PYTHON_BACKEND_URL;
  
  // 1. Attempt direct connection to Python FastAPI
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${targetUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        connected: true,
        checking: false,
        backendUrl: targetUrl,
        version: data.version || '1.0.0',
        lastChecked: new Date().toLocaleTimeString()
      };
    }
  } catch (err: any) {
    // Continue to proxy fallback
  }

  // 2. Attempt fallback via Express proxy
  try {
    const proxyRes = await fetch('/api/transition/py-status', {
      headers: { 'Accept': 'application/json' }
    });
    if (proxyRes.ok) {
      const pData = await proxyRes.json();
      if (pData.connected) {
        return {
          connected: true,
          checking: false,
          backendUrl: pData.backendUrl || targetUrl,
          version: '1.0.0 (proxied)',
          lastChecked: new Date().toLocaleTimeString()
        };
      }
    }
  } catch (err: any) {
    // Proxy also failed
  }

  return {
    connected: false,
    checking: false,
    backendUrl: targetUrl,
    lastChecked: new Date().toLocaleTimeString(),
    error: 'FastAPI backend offline at port 8000'
  };
}

/**
 * Converts a raw ratio entry from Python FastAPI into a TypeScript RatioValue.
 */
function mapPythonRatio(item: any, fallbackFormula: string = ''): RatioValue {
  if (!item) {
    return {
      value: null,
      formatted: 'N/A',
      isCalculable: false,
      status: 'neutral',
      explanation: 'Not evaluated',
      formula: fallbackFormula
    };
  }

  return {
    value: item.value ?? null,
    formatted: item.formatted ?? (item.value != null ? `${item.value}` : 'N/A'),
    isCalculable: item.is_calculable ?? (item.value != null),
    status: (item.status as any) || 'healthy',
    explanation: item.explanation || '',
    formula: item.formula || fallbackFormula
  };
}

/**
 * Maps the Python statement computation response into the frontend's StoredFinancialModel schema.
 */
export function mapPythonStatementsToStoredModel(pyResult: any): StoredFinancialModel {
  const inc = pyResult.income || {};
  const bs = pyResult.balance_sheet || {};
  const cf = pyResult.cash_flow || {};
  const r = pyResult.ratios || {};

  const rev = inc.revenue || 0;
  const cogs = inc.cogs || 0;
  const curAssets = bs.current_assets || 0;
  const curLiab = bs.current_liabilities || 0;
  const workingCapVal = r.working_capital?.value ?? (curAssets - curLiab);

  return {
    isConfigured: true,
    reportingPeriod: inc.period || 'FY2024',
    currency: 'MYR',
    sourceFileName: 'Python FastAPI Deterministic Engine (Port 8000)',
    incomeStatement: {
      period: inc.period || 'FY2024',
      revenue: rev,
      cogs: cogs,
      grossProfit: inc.gross_profit ?? (rev - cogs),
      operatingExpenses: inc.operating_expenses || 0,
      ebitda: inc.ebitda || 0,
      depreciationAmortisation: inc.depreciation_amortisation || 0,
      ebit: inc.ebit || 0,
      financeCosts: inc.finance_costs || 0,
      profitBeforeTax: inc.profit_before_tax || 0,
      incomeTaxExpense: inc.income_tax_expense || 0,
      netProfit: inc.net_profit || 0
    },
    balanceSheet: {
      period: bs.period || 'FY2024',
      cash: bs.cash || 0,
      accountsReceivable: bs.accounts_receivable || 0,
      inventory: bs.inventory || 0,
      otherCurrentAssets: bs.other_current_assets || 0,
      currentAssets: curAssets,
      fixedAssetsAtCost: bs.fixed_assets_at_cost || 0,
      accumulatedDepreciation: bs.accumulated_depreciation || 0,
      netFixedAssets: bs.net_fixed_assets || 0,
      otherAssets: bs.other_assets || 0,
      totalAssets: bs.total_assets || 0,
      accountsPayable: bs.accounts_payable || 0,
      shortTermDebt: bs.short_term_debt || 0,
      otherCurrentLiabilities: bs.other_current_liabilities || 0,
      currentLiabilities: curLiab,
      longTermDebt: bs.long_term_debt || 0,
      otherLiabilities: bs.other_liabilities || 0,
      totalLiabilities: bs.total_liabilities || 0,
      capital: bs.capital || 0,
      retainedEarnings: bs.retained_earnings || 0,
      ownerDrawings: bs.owner_drawings || 0,
      otherEquity: bs.other_equity || 0,
      totalEquity: bs.total_equity || 0,
      totalLiabilitiesAndEquity: bs.total_liabilities_and_equity || 0,
      reconciliationDifference: bs.reconciliation_difference || 0,
      isReconciled: bs.is_reconciled ?? (Math.abs((bs.reconciliation_difference || 0)) < 1)
    },
    cashFlowStatement: {
      period: cf.period || 'FY2024',
      openingCash: cf.opening_cash || 0,
      netProfit: cf.net_profit || 0,
      depreciationAddBack: cf.depreciation_add_back || 0,
      deltaAccountsReceivable: cf.delta_accounts_receivable || 0,
      deltaInventory: cf.delta_inventory || 0,
      deltaAccountsPayable: cf.delta_accounts_payable || 0,
      otherOperatingAdjustments: cf.other_operating_adjustments || 0,
      operatingCashFlow: cf.operating_cash_flow || 0,
      capitalExpenditure: cf.capital_expenditure || 0,
      assetDisposals: cf.asset_disposals || 0,
      investingCashFlow: cf.investing_cash_flow || 0,
      newBorrowing: cf.new_borrowing || 0,
      principalRepayments: cf.principal_repayments || 0,
      equityContributions: cf.equity_contributions || 0,
      drawings: cf.drawings || 0,
      financingCashFlow: cf.financing_cash_flow || 0,
      netChangeInCash: cf.net_change_in_cash || 0,
      closingCash: cf.closing_cash || 0,
      balanceSheetCash: cf.balance_sheet_cash || 0,
      cashReconciliationDifference: cf.cash_reconciliation_difference || 0,
      isReconciled: cf.is_reconciled ?? (Math.abs((cf.cash_reconciliation_difference || 0)) < 1)
    },
    ratios: {
      period: r.period || 'FY2024',
      currentRatio: mapPythonRatio(r.current_ratio, 'Current Assets / Current Liabilities'),
      quickRatio: mapPythonRatio(r.quick_ratio, '(Cash + AR) / Current Liabilities'),
      cashRatio: mapPythonRatio(r.cash_ratio, 'Cash / Current Liabilities'),
      workingCapital: {
        value: workingCapVal,
        formatted: r.working_capital?.formatted ?? `RM ${workingCapVal.toLocaleString()}`
      },
      debtToEquityTotal: mapPythonRatio(r.debt_to_equity_total, 'Total Liabilities / Total Equity'),
      debtToEquityInterestBearing: mapPythonRatio(r.debt_to_equity_interest_bearing, 'Interest-Bearing Debt / Total Equity'),
      debtRatio: mapPythonRatio(r.debt_ratio, 'Total Liabilities / Total Assets'),
      interestCoverage: mapPythonRatio(r.interest_coverage, 'EBIT / Finance Costs'),
      equityMultiplier: mapPythonRatio(r.equity_multiplier, 'Total Assets / Total Equity'),
      grossProfitMargin: mapPythonRatio(r.gross_profit_margin, 'Gross Profit / Revenue'),
      netProfitMargin: mapPythonRatio(r.net_profit_margin, 'Net Profit / Revenue'),
      ebitdaMargin: mapPythonRatio(r.ebitda_margin, 'EBITDA / Revenue'),
      returnOnAssets: mapPythonRatio(r.return_on_assets, 'Net Profit / Average Total Assets'),
      returnOnEquity: mapPythonRatio(r.return_on_equity, 'Net Profit / Average Total Equity'),
      daysSalesOutstanding: mapPythonRatio(r.days_sales_outstanding, '(AR * 365) / Credit Sales'),
      daysInventoryOutstanding: mapPythonRatio(r.days_inventory_outstanding, '(Inventory * 365) / COGS'),
      daysPayableOutstanding: mapPythonRatio(r.days_payable_outstanding, '(AP * 365) / Credit Purchases'),
      cashConversionCycle: mapPythonRatio(r.cash_conversion_cycle, 'DSO + DIO - DPO'),
      assetTurnover: mapPythonRatio(r.asset_turnover, 'Revenue / Average Total Assets'),
      inventoryTurnover: mapPythonRatio(r.inventory_turnover, 'COGS / Average Inventory')
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Triggers full deterministic financial statement & DSCR computation on Python FastAPI.
 */
export async function executePythonFinancialComputation(
  profile: BusinessProfile,
  customPayload?: any
): Promise<PythonEngineComputationResult> {
  const period = `FY${profile.reportingYear || 2024}`;
  const rev = profile.annualRevenue > 0 ? profile.annualRevenue : 3200000;
  const opex = profile.annualOperatingExpenses > 0 ? profile.annualOperatingExpenses : 680000;
  const cash = profile.cashBalance > 0 ? profile.cashBalance : 312500;
  const ads = profile.existingAnnualDebtService > 0 ? profile.existingAnnualDebtService : 38000;

  const payload = customPayload || {
    period,
    currency: profile.currency || 'MYR',
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

  // Try direct FastAPI port 8000 first
  try {
    const res = await fetch(`${DEFAULT_PYTHON_BACKEND_URL}/api/finance/statements/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      const model = mapPythonStatementsToStoredModel(data);
      return {
        success: true,
        model,
        raw: data,
        auditHash: data.audit?.inputs_hash
      };
    }
  } catch (err: any) {
    // Try Express proxy fallback
  }

  // Fallback via Express proxy
  try {
    const proxyRes = await fetch('/api/transition/py-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (proxyRes.ok) {
      const pData = await proxyRes.json();
      const rawData = pData.result || pData;
      const model = mapPythonStatementsToStoredModel(rawData);
      return {
        success: true,
        model,
        raw: rawData,
        auditHash: rawData.audit?.inputs_hash
      };
    }
    const errText = await proxyRes.text();
    return { success: false, error: `Proxy compute error: ${errText}` };
  } catch (err: any) {
    return { success: false, error: `Python Engine offline: ${err.message}` };
  }
}

/**
 * Uploads a CSV/XLSX file directly to Python FastAPI's /ingest/energy-csv or /ingest/upload.
 */
export async function uploadFileToPythonIngestion(
  file: File,
  sector: string = 'total',
  reportingYear: number = 2024
): Promise<{ success: boolean; data?: any; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);

  // Try direct FastAPI first
  try {
    const endpoint = `${DEFAULT_PYTHON_BACKEND_URL}/ingest/energy-csv?sector=${encodeURIComponent(sector)}&year=${reportingYear}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
  } catch (e: any) {
    // Fall back to universal upload
  }

  try {
    const uFormData = new FormData();
    uFormData.append('files', file);
    const uEndpoint = `${DEFAULT_PYTHON_BACKEND_URL}/ingest/upload?sector=${encodeURIComponent(sector)}&reporting_year=${reportingYear}`;
    const uRes = await fetch(uEndpoint, {
      method: 'POST',
      body: uFormData
    });
    if (uRes.ok) {
      const data = await uRes.json();
      return { success: true, data };
    }
    const errText = await uRes.text();
    return { success: false, error: errText };
  } catch (e: any) {
    return { success: false, error: `Upload to Python Engine failed: ${e.message}` };
  }
}
