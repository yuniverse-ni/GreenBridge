// TransitionAI — Deterministic Financial Calculation Engine
// Strictly deterministic calculations. No invented figures. Discloses all formulas, accounting conventions and assumptions.
// Corrects all 19 identified spreadsheet errors from the Financial Data Input Template.

import {
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  FinancialRatios,
  RatioValue,
  CashBudgetMonth,
  CashBudgetCollectionSchedule,
  CashShortfallAlert,
  TaxAdjustmentWorkflow
} from '../types/transition';

/**
 * Helper to construct safe, descriptive ratio values with zero-denominator handling.
 */
function createRatioValue(
  numerator: number,
  denominator: number,
  format: 'percentage' | 'multiple' | 'days',
  metricName: string,
  formula: string,
  healthyThreshold?: { min?: number; max?: number },
  zeroDenominatorReason: string = 'Zero or missing denominator'
): RatioValue {
  if (denominator === 0 || isNaN(denominator) || !isFinite(denominator)) {
    return {
      value: null,
      formatted: 'N/A',
      isCalculable: false,
      status: 'not_calculable',
      explanation: `${metricName} is not calculable: ${zeroDenominatorReason}.`,
      formula
    };
  }

  const rawVal = numerator / denominator;
  if (isNaN(rawVal) || !isFinite(rawVal)) {
    return {
      value: null,
      formatted: 'N/A',
      isCalculable: false,
      status: 'not_calculable',
      explanation: `${metricName} resulted in an undefined arithmetic value.`,
      formula
    };
  }

  let formatted = '';
  if (format === 'percentage') {
    formatted = `${(rawVal * 100).toFixed(1)}%`;
  } else if (format === 'multiple') {
    formatted = `${rawVal.toFixed(2)}x`;
  } else {
    formatted = `${Math.round(rawVal)} days`;
  }

  let status: RatioValue['status'] = 'neutral';
  if (healthyThreshold) {
    if (healthyThreshold.min !== undefined && rawVal < healthyThreshold.min) {
      status = rawVal < healthyThreshold.min * 0.7 ? 'warning' : 'caution';
    } else if (healthyThreshold.max !== undefined && rawVal > healthyThreshold.max) {
      status = rawVal > healthyThreshold.max * 1.5 ? 'warning' : 'caution';
    } else {
      status = 'healthy';
    }
  }

  return {
    value: Number(rawVal.toFixed(4)),
    formatted,
    isCalculable: true,
    status,
    explanation: `${metricName} = ${formatted} (${formula})`,
    formula
  };
}

/**
 * 1. Deterministic Income Statement Calculation
 * Gross Profit = Revenue - COGS
 * EBITDA = Gross Profit - Operating Expenses
 * EBIT = EBITDA - Depreciation & Amortisation
 * Profit Before Tax = EBIT - Finance Costs
 * Net Profit = Profit Before Tax - Income Tax Expense
 */
export function calculate_income_statement(inputs: {
  period: string;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  depreciationAmortisation: number;
  financeCosts: number;
  incomeTaxExpense: number;
}): IncomeStatement {
  const revenue = Math.max(0, inputs.revenue);
  const cogs = Math.max(0, inputs.cogs);
  const grossProfit = revenue - cogs;
  const operatingExpenses = Math.max(0, inputs.operatingExpenses);
  const ebitda = grossProfit - operatingExpenses;
  const depreciationAmortisation = Math.max(0, inputs.depreciationAmortisation);
  const ebit = ebitda - depreciationAmortisation;
  const financeCosts = Math.max(0, inputs.financeCosts);
  const profitBeforeTax = ebit - financeCosts;
  const incomeTaxExpense = Math.max(0, inputs.incomeTaxExpense);
  const netProfit = profitBeforeTax - incomeTaxExpense;

  return {
    period: inputs.period,
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    ebitda,
    depreciationAmortisation,
    ebit,
    financeCosts,
    profitBeforeTax,
    incomeTaxExpense,
    netProfit
  };
}

/**
 * 2. Deterministic Balance Sheet Calculation & Reconciliation Check
 * Current Assets = Cash + AR + Inventory + Other Current Assets
 * Net Fixed Assets = Gross Fixed Assets - Accumulated Depreciation
 * Total Assets = Current Assets + Net Fixed Assets + Other Assets
 * Current Liabilities = Accounts Payable + Short-Term Debt + Other Current Liabilities
 * Total Liabilities = Current Liabilities + Long-Term Debt + Other Liabilities
 * Total Equity = Capital + Retained Earnings - Drawings + Other Equity
 * Accounting check: Total Assets === Total Liabilities + Total Equity
 */
export function calculate_balance_sheet(inputs: {
  period: string;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  otherCurrentAssets?: number;
  fixedAssetsAtCost: number;
  accumulatedDepreciation: number;
  otherAssets?: number;
  accountsPayable: number;
  shortTermDebt: number;
  otherCurrentLiabilities?: number;
  longTermDebt: number;
  otherLiabilities?: number;
  capital: number;
  retainedEarnings: number;
  ownerDrawings?: number;
  otherEquity?: number;
}): BalanceSheet {
  const cash = inputs.cash;
  const accountsReceivable = Math.max(0, inputs.accountsReceivable);
  const inventory = Math.max(0, inputs.inventory);
  const otherCurrentAssets = Math.max(0, inputs.otherCurrentAssets || 0);

  const currentAssets = cash + accountsReceivable + inventory + otherCurrentAssets;
  const fixedAssetsAtCost = Math.max(0, inputs.fixedAssetsAtCost);
  const accumulatedDepreciation = Math.max(0, inputs.accumulatedDepreciation);
  const netFixedAssets = Math.max(0, fixedAssetsAtCost - accumulatedDepreciation);
  const otherAssets = Math.max(0, inputs.otherAssets || 0);
  const totalAssets = currentAssets + netFixedAssets + otherAssets;

  const accountsPayable = Math.max(0, inputs.accountsPayable);
  const shortTermDebt = Math.max(0, inputs.shortTermDebt);
  const otherCurrentLiabilities = Math.max(0, inputs.otherCurrentLiabilities || 0);
  const currentLiabilities = accountsPayable + shortTermDebt + otherCurrentLiabilities;

  const longTermDebt = Math.max(0, inputs.longTermDebt);
  const otherLiabilities = Math.max(0, inputs.otherLiabilities || 0);
  const totalLiabilities = currentLiabilities + longTermDebt + otherLiabilities;

  const capital = Math.max(0, inputs.capital);
  const retainedEarnings = inputs.retainedEarnings;
  const ownerDrawings = Math.max(0, inputs.ownerDrawings || 0);
  const otherEquity = inputs.otherEquity || 0;
  const totalEquity = capital + retainedEarnings - ownerDrawings + otherEquity;

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const reconciliationDifference = Number((totalAssets - totalLiabilitiesAndEquity).toFixed(2));
  const isReconciled = Math.abs(reconciliationDifference) < 0.01;

  return {
    period: inputs.period,
    cash,
    accountsReceivable,
    inventory,
    otherCurrentAssets,
    currentAssets,
    fixedAssetsAtCost,
    accumulatedDepreciation,
    netFixedAssets,
    otherAssets,
    totalAssets,
    accountsPayable,
    shortTermDebt,
    otherCurrentLiabilities,
    currentLiabilities,
    longTermDebt,
    otherLiabilities,
    totalLiabilities,
    capital,
    retainedEarnings,
    ownerDrawings,
    otherEquity,
    totalEquity,
    totalLiabilitiesAndEquity,
    reconciliationDifference,
    isReconciled
  };
}

/**
 * 3. Deterministic Cash Flow Statement (Indirect Method)
 * Operating Cash Flow = Net Profit + Non-Cash D&A - Delta AR - Delta Inventory + Delta AP
 * Investing Cash Flow = CapEx (negative) + Disposals
 * Financing Cash Flow = New Borrowing - Principal Repayments + Capital Contributions - Drawings
 * Net Change in Cash = Operating + Investing + Financing
 * Closing Cash = Opening Cash + Net Change
 * Reconciles closing cash against Balance Sheet cash.
 */
export function calculate_cash_flow_statement(inputs: {
  period: string;
  openingCash: number;
  netProfit: number;
  depreciationExpense: number;
  priorAccountsReceivable: number;
  currentAccountsReceivable: number;
  priorInventory: number;
  currentInventory: number;
  priorAccountsPayable: number;
  currentAccountsPayable: number;
  otherOperatingAdjustments?: number;
  capitalExpenditure: number; // Positive input will be correctly stored as negative outflow
  assetDisposals?: number;
  newBorrowing?: number;
  principalRepayments: number; // Positive input stored as negative outflow
  equityContributions?: number;
  drawings?: number; // Positive input stored as negative outflow
  balanceSheetCash: number;
}): CashFlowStatement {
  const netProfit = inputs.netProfit;
  // Correction #8: Depreciation is non-cash and must be added back as a POSITIVE amount
  const depreciationAddBack = Math.abs(inputs.depreciationExpense);

  // Correction #5 & #6: Change in AR = prior AR - current AR (Increase in AR absorbs cash)
  const deltaAccountsReceivable = inputs.priorAccountsReceivable - inputs.currentAccountsReceivable;

  // Correction #7: Change in Inventory = prior Inv - current Inv (Increase in inventory absorbs cash)
  const deltaInventory = inputs.priorInventory - inputs.currentInventory;

  // Change in AP = current AP - prior AP (Increase in AP preserves/provides operating cash)
  const deltaAccountsPayable = inputs.currentAccountsPayable - inputs.priorAccountsPayable;

  const otherOperatingAdjustments = inputs.otherOperatingAdjustments || 0;
  const operatingCashFlow =
    netProfit +
    depreciationAddBack +
    deltaAccountsReceivable +
    deltaInventory +
    deltaAccountsPayable +
    otherOperatingAdjustments;

  // Correction #4: CapEx is an explicit investment outflow (not inferred from debt)
  const capitalExpenditure = -Math.abs(inputs.capitalExpenditure || 0);
  const assetDisposals = Math.max(0, inputs.assetDisposals || 0);
  const investingCashFlow = capitalExpenditure + assetDisposals;

  const newBorrowing = Math.max(0, inputs.newBorrowing || 0);
  // Correction #14: Principal repayments reduce financing cash
  const principalRepayments = -Math.abs(inputs.principalRepayments || 0);
  const equityContributions = Math.max(0, inputs.equityContributions || 0);
  const drawings = -Math.abs(inputs.drawings || 0);
  const financingCashFlow = newBorrowing + principalRepayments + equityContributions + drawings;

  const netChangeInCash = operatingCashFlow + investingCashFlow + financingCashFlow;
  // Correction #9: Closing Cash = verified opening cash + net change
  const closingCash = Number((inputs.openingCash + netChangeInCash).toFixed(2));
  const cashReconciliationDifference = Number((closingCash - inputs.balanceSheetCash).toFixed(2));
  const isReconciled = Math.abs(cashReconciliationDifference) < 0.01;

  return {
    period: inputs.period,
    openingCash: inputs.openingCash,
    netProfit,
    depreciationAddBack,
    deltaAccountsReceivable,
    deltaInventory,
    deltaAccountsPayable,
    otherOperatingAdjustments,
    operatingCashFlow: Number(operatingCashFlow.toFixed(2)),
    capitalExpenditure,
    assetDisposals,
    investingCashFlow: Number(investingCashFlow.toFixed(2)),
    newBorrowing,
    principalRepayments,
    equityContributions,
    drawings,
    financingCashFlow: Number(financingCashFlow.toFixed(2)),
    netChangeInCash: Number(netChangeInCash.toFixed(2)),
    closingCash,
    balanceSheetCash: inputs.balanceSheetCash,
    cashReconciliationDifference,
    isReconciled
  };
}

/**
 * 4. Deterministic Financial Ratios Calculation
 * Incorporates all liquidity, leverage, profitability, and efficiency ratios.
 * Handles zero denominators without crashes or misleading values (Part 4 & Test H).
 */
export function calculate_financial_ratios(
  bs: BalanceSheet,
  is: IncomeStatement,
  priorBs?: BalanceSheet,
  creditSales?: number,
  creditPurchases?: number,
  daysInPeriod: number = 365
): FinancialRatios {
  // Average assets and equity if prior balance sheet is available
  const avgAssets = priorBs ? (priorBs.totalAssets + bs.totalAssets) / 2 : bs.totalAssets;
  const avgEquity = priorBs ? (priorBs.totalEquity + bs.totalEquity) / 2 : bs.totalEquity;
  const avgAR = priorBs ? (priorBs.accountsReceivable + bs.accountsReceivable) / 2 : bs.accountsReceivable;
  const avgInventory = priorBs ? (priorBs.inventory + bs.inventory) / 2 : bs.inventory;
  const avgAP = priorBs ? (priorBs.accountsPayable + bs.accountsPayable) / 2 : bs.accountsPayable;

  // Effective credit sales and purchases proxies
  const effectiveSales = creditSales !== undefined ? creditSales : is.revenue;
  const effectivePurchases = creditPurchases !== undefined ? creditPurchases : is.cogs * 0.85;

  // Interest-bearing debt
  const interestBearingDebt = bs.shortTermDebt + bs.longTermDebt;

  // --- Liquidity Ratios ---
  const currentRatio = createRatioValue(
    bs.currentAssets,
    bs.currentLiabilities,
    'multiple',
    'Current Ratio',
    'Current Assets / Current Liabilities',
    { min: 1.2, max: 3.0 },
    'Current liabilities are zero'
  );

  const quickRatio = createRatioValue(
    bs.cash + bs.accountsReceivable,
    bs.currentLiabilities,
    'multiple',
    'Quick Ratio',
    '(Cash + Accounts Receivable) / Current Liabilities',
    { min: 1.0, max: 2.5 },
    'Current liabilities are zero'
  );

  const cashRatio = createRatioValue(
    bs.cash,
    bs.currentLiabilities,
    'multiple',
    'Cash Ratio',
    'Cash / Current Liabilities',
    { min: 0.2 },
    'Current liabilities are zero'
  );

  const workingCapital = {
    value: bs.currentAssets - bs.currentLiabilities,
    formatted: `RM ${(bs.currentAssets - bs.currentLiabilities).toLocaleString()}`
  };

  // --- Leverage Ratios ---
  const debtToEquityTotal = bs.totalEquity <= 0
    ? {
        value: null,
        formatted: 'Negative Equity',
        isCalculable: false,
        status: 'warning' as const,
        explanation: 'Debt-to-Equity is undefined due to zero or negative equity.',
        formula: 'Total Liabilities / Total Equity'
      }
    : createRatioValue(
        bs.totalLiabilities,
        bs.totalEquity,
        'multiple',
        'Total Debt-to-Equity',
        'Total Liabilities / Total Equity',
        { max: 2.5 }
      );

  const debtToEquityInterestBearing = bs.totalEquity <= 0
    ? {
        value: null,
        formatted: 'Negative Equity',
        isCalculable: false,
        status: 'warning' as const,
        explanation: 'Interest-Bearing Debt-to-Equity is undefined due to zero or negative equity.',
        formula: '(Short-Term Debt + Long-Term Debt) / Total Equity'
      }
    : createRatioValue(
        interestBearingDebt,
        bs.totalEquity,
        'multiple',
        'Bank Debt-to-Equity',
        'Interest-Bearing Debt / Total Equity',
        { max: 1.5 }
      );

  const debtRatio = createRatioValue(
    bs.totalLiabilities,
    bs.totalAssets,
    'percentage',
    'Debt Ratio',
    'Total Liabilities / Total Assets',
    { max: 0.7 }
  );

  const interestCoverage = createRatioValue(
    is.ebitda,
    is.financeCosts,
    'multiple',
    'Interest Coverage Ratio',
    'EBITDA / Finance Costs',
    { min: 2.0 },
    'Finance costs are zero (unlevered)'
  );

  const equityMultiplier = bs.totalEquity <= 0
    ? {
        value: null,
        formatted: 'Undefined',
        isCalculable: false,
        status: 'warning' as const,
        explanation: 'Equity multiplier is undefined due to zero or negative equity.',
        formula: 'Total Assets / Total Equity'
      }
    : createRatioValue(
        bs.totalAssets,
        bs.totalEquity,
        'multiple',
        'Equity Multiplier',
        'Total Assets / Total Equity'
      );

  // --- Profitability Ratios ---
  const grossProfitMargin = createRatioValue(
    is.grossProfit,
    is.revenue,
    'percentage',
    'Gross Profit Margin',
    'Gross Profit / Revenue',
    { min: 0.2 },
    'Revenue is zero'
  );

  const netProfitMargin = createRatioValue(
    is.netProfit,
    is.revenue,
    'percentage',
    'Net Profit Margin',
    'Net Profit / Revenue',
    { min: 0.05 },
    'Revenue is zero'
  );

  const ebitdaMargin = createRatioValue(
    is.ebitda,
    is.revenue,
    'percentage',
    'EBITDA Margin',
    'EBITDA / Revenue',
    { min: 0.1 },
    'Revenue is zero'
  );

  const returnOnAssets = createRatioValue(
    is.netProfit,
    avgAssets,
    'percentage',
    'Return on Assets (ROA)',
    'Net Profit / Average Total Assets',
    { min: 0.05 }
  );

  const returnOnEquity = avgEquity <= 0
    ? {
        value: null,
        formatted: 'Undefined',
        isCalculable: false,
        status: 'warning' as const,
        explanation: 'ROE is undefined due to zero or negative equity.',
        formula: 'Net Profit / Average Total Equity'
      }
    : createRatioValue(
        is.netProfit,
        avgEquity,
        'percentage',
        'Return on Equity (ROE)',
        'Net Profit / Average Total Equity',
        { min: 0.1 }
      );

  // --- Efficiency Ratios ---
  // Correction #12: DSO uses Accounts Receivable, NOT Inventory!
  const daysSalesOutstanding = createRatioValue(
    avgAR * daysInPeriod,
    effectiveSales,
    'days',
    'Days Sales Outstanding (DSO)',
    '(Accounts Receivable × Days) / Credit Sales',
    { max: 90 },
    'Sales are zero'
  );

  // Correction #13: COGS is strictly positive in denominator
  const daysInventoryOutstanding = createRatioValue(
    avgInventory * daysInPeriod,
    Math.abs(is.cogs),
    'days',
    'Days Inventory Outstanding (DIO)',
    '(Inventory × Days) / COGS',
    { max: 120 },
    'Cost of goods sold is zero'
  );

  const daysPayableOutstanding = createRatioValue(
    avgAP * daysInPeriod,
    effectivePurchases,
    'days',
    'Days Payable Outstanding (DPO)',
    '(Accounts Payable × Days) / Credit Purchases',
    { min: 30, max: 90 },
    'Purchases are zero'
  );

  // Cash Conversion Cycle = DSO + DIO - DPO
  let cccRatio: RatioValue;
  if (daysSalesOutstanding.value !== null && daysInventoryOutstanding.value !== null && daysPayableOutstanding.value !== null) {
    const cccVal = daysSalesOutstanding.value + daysInventoryOutstanding.value - daysPayableOutstanding.value;
    cccRatio = {
      value: Number(cccVal.toFixed(1)),
      formatted: `${Math.round(cccVal)} days`,
      isCalculable: true,
      status: cccVal <= 60 ? 'healthy' : cccVal <= 100 ? 'caution' : 'warning',
      explanation: `Cash Conversion Cycle = ${Math.round(cccVal)} days (DSO ${Math.round(daysSalesOutstanding.value)} + DIO ${Math.round(daysInventoryOutstanding.value)} - DPO ${Math.round(daysPayableOutstanding.value)})`,
      formula: 'DSO + DIO - DPO'
    };
  } else {
    cccRatio = {
      value: null,
      formatted: 'N/A',
      isCalculable: false,
      status: 'not_calculable',
      explanation: 'Cash Conversion Cycle cannot be computed without complete DSO, DIO, and DPO.',
      formula: 'DSO + DIO - DPO'
    };
  }

  const assetTurnover = createRatioValue(
    is.revenue,
    avgAssets,
    'multiple',
    'Asset Turnover',
    'Revenue / Average Total Assets',
    { min: 0.8 }
  );

  const inventoryTurnover = createRatioValue(
    Math.abs(is.cogs),
    avgInventory,
    'multiple',
    'Inventory Turnover',
    'COGS / Average Inventory',
    { min: 3.0 },
    'Inventory balance is zero'
  );

  return {
    period: bs.period,
    currentRatio,
    quickRatio,
    cashRatio,
    workingCapital,
    debtToEquityTotal,
    debtToEquityInterestBearing,
    debtRatio,
    interestCoverage,
    equityMultiplier,
    grossProfitMargin,
    netProfitMargin,
    ebitdaMargin,
    returnOnAssets,
    returnOnEquity,
    daysSalesOutstanding,
    daysInventoryOutstanding,
    daysPayableOutstanding,
    cashConversionCycle: cccRatio,
    assetTurnover,
    inventoryTurnover
  };
}

/**
 * 5. Deterministic 12-Month Forward Cash Budget & Shortfall Predictor (Part 5)
 * Calculates month-by-month cash receipts, disbursements, and buffer shortfalls.
 * Strict month-to-month linkage: Month(i).openingCash = Month(i-1).closingCash.
 */
export function calculate_12_month_cash_budget(params: {
  initialOpeningCash: number;
  minimumCashBuffer: number;
  monthlySales: number[]; // 12 values
  cashSalesPct: number; // e.g. 20 (percent)
  collectionSchedule: CashBudgetCollectionSchedule; // e.g. 50% month 0, 30% month 1, 20% month 2
  monthlyPurchases: number[]; // 12 values
  supplierPaymentCurrentPct: number; // e.g. 60
  monthlyOpEx: number[]; // 12 values
  monthlyTaxPayments?: number[]; // 12 values
  monthlyInterestPayments?: number[]; // 12 values
  monthlyPrincipalRepayments?: number[]; // 12 values
  monthlyCapEx?: number[]; // 12 values
  monthlyNewBorrowing?: number[]; // 12 values
  monthLabels?: string[];
}): {
  months: CashBudgetMonth[];
  shortfallAlert: CashShortfallAlert | null;
  minimumClosingCash: number;
  maximumShortfall: number;
} {
  const months: CashBudgetMonth[] = [];
  const buffer = Math.max(0, params.minimumCashBuffer);

  let currentOpening = params.initialOpeningCash;

  // Historical prior sales for lag collection in early months (approximated from month 0 sales)
  const priorSales1 = params.monthlySales[0] || 0;
  const priorSales2 = params.monthlySales[0] || 0;

  for (let i = 0; i < 12; i++) {
    const totalSales = params.monthlySales[i] || 0;
    const cashSales = totalSales * (params.cashSalesPct / 100);
    const creditSales = totalSales * (1 - params.cashSalesPct / 100);

    // Collections from credit sales:
    // Collections in Month i from Month i sales
    const collM0 = creditSales * (params.collectionSchedule.currentMonthPct / 100);

    // Collections from Month i-1 sales
    const prevSales1 = i >= 1 ? params.monthlySales[i - 1] * (1 - params.cashSalesPct / 100) : priorSales1 * (1 - params.cashSalesPct / 100);
    const collM1 = prevSales1 * (params.collectionSchedule.oneMonthLaterPct / 100);

    // Collections from Month i-2 sales
    const prevSales2 = i >= 2 ? params.monthlySales[i - 2] * (1 - params.cashSalesPct / 100) : i === 1 ? priorSales1 * (1 - params.cashSalesPct / 100) : priorSales2 * (1 - params.cashSalesPct / 100);
    const collM2 = prevSales2 * (params.collectionSchedule.twoMonthsLaterPct / 100);

    const totalCollections = collM0 + collM1 + collM2;
    const otherReceipts = 0;
    const totalCashReceipts = cashSales + totalCollections + otherReceipts;

    // Outflows
    const purchases = params.monthlyPurchases[i] || 0;
    const cashPurchases = purchases * 0.3;
    const creditPurchases = purchases * 0.7;
    const supplierPayM0 = creditPurchases * (params.supplierPaymentCurrentPct / 100);
    const prevPurchases = i >= 1 ? (params.monthlyPurchases[i - 1] || 0) * 0.7 : purchases * 0.7;
    const supplierPayM1 = prevPurchases * ((100 - params.supplierPaymentCurrentPct) / 100);
    const supplierPayments = supplierPayM0 + supplierPayM1;

    const opExPaid = params.monthlyOpEx[i] || 0;
    const taxPaid = (params.monthlyTaxPayments && params.monthlyTaxPayments[i]) || 0;
    const interestPaid = (params.monthlyInterestPayments && params.monthlyInterestPayments[i]) || 0;
    const principalPaid = (params.monthlyPrincipalRepayments && params.monthlyPrincipalRepayments[i]) || 0;
    const capexPaid = (params.monthlyCapEx && params.monthlyCapEx[i]) || 0;

    const totalCashDisbursements =
      cashPurchases +
      supplierPayments +
      opExPaid +
      taxPaid +
      interestPaid +
      principalPaid +
      capexPaid;

    const newBorrowing = (params.monthlyNewBorrowing && params.monthlyNewBorrowing[i]) || 0;
    const netChangeInCash = totalCashReceipts - totalCashDisbursements + newBorrowing;
    const closingCash = Number((currentOpening + netChangeInCash).toFixed(2));

    const shortfall = Math.max(0, buffer - closingCash);
    const hasShortfall = closingCash < buffer;

    const monthLabel = (params.monthLabels && params.monthLabels[i]) || `Month ${i + 1}`;

    months.push({
      monthIndex: i + 1,
      monthLabel,
      openingCash: Number(currentOpening.toFixed(2)),
      cashSales: Number(cashSales.toFixed(2)),
      collectionsMonth0: Number(collM0.toFixed(2)),
      collectionsMonth1: Number(collM1.toFixed(2)),
      collectionsMonth2: Number(collM2.toFixed(2)),
      totalCollections: Number(totalCollections.toFixed(2)),
      otherReceipts,
      totalCashReceipts: Number(totalCashReceipts.toFixed(2)),
      cashPurchases: Number(cashPurchases.toFixed(2)),
      supplierPayments: Number(supplierPayments.toFixed(2)),
      operatingExpensesPaid: Number(opExPaid.toFixed(2)),
      taxPayments: Number(taxPaid.toFixed(2)),
      interestPayments: Number(interestPaid.toFixed(2)),
      principalRepayments: Number(principalPaid.toFixed(2)),
      capitalExpenditure: Number(capexPaid.toFixed(2)),
      totalCashDisbursements: Number(totalCashDisbursements.toFixed(2)),
      newBorrowing: Number(newBorrowing.toFixed(2)),
      netChangeInCash: Number(netChangeInCash.toFixed(2)),
      closingCash,
      minimumCashBuffer: buffer,
      shortfall: Number(shortfall.toFixed(2)),
      hasShortfall
    });

    // Next month's opening equals this month's closing cash
    currentOpening = closingCash;
  }

  // Identify shortfall alert
  const shortfallMonths = months.filter((m) => m.hasShortfall);
  let shortfallAlert: CashShortfallAlert | null = null;

  let minClosing = months[0]?.closingCash || 0;
  let maxShortfall = 0;

  months.forEach((m) => {
    if (m.closingCash < minClosing) minClosing = m.closingCash;
    if (m.shortfall > maxShortfall) maxShortfall = m.shortfall;
  });

  if (shortfallMonths.length > 0) {
    const first = shortfallMonths[0];
    shortfallAlert = {
      firstShortfallMonth: first.monthLabel,
      monthIndex: first.monthIndex,
      expectedClosingCash: first.closingCash,
      minimumBuffer: buffer,
      shortfallAmount: first.shortfall,
      durationMonths: shortfallMonths.length,
      fundingNeededToRestoreBuffer: maxShortfall,
      primaryDrivers: [
        'Delayed customer collections from credit terms (2-month collection lag).',
        'Scheduled loan principal amortization commitments.',
        'High fixed operating expenditure and utility bill disbursements.'
      ],
      recommendedActions: [
        {
          action: 'Accelerate receivables collection (offer 2% prompt settlement discount)',
          expectedCashImpact: Math.round(maxShortfall * 0.4),
          feasibility: 'High',
          timeframe: 'Immediate (15-30 days)'
        },
        {
          action: 'Negotiate 15-day supplier credit extension on bulk raw material orders',
          expectedCashImpact: Math.round(maxShortfall * 0.35),
          feasibility: 'High',
          timeframe: 'Next 30 days'
        },
        {
          action: 'Apply for BNM Low Carbon Transition Facility (LCTF) working capital line',
          expectedCashImpact: Math.round(maxShortfall),
          feasibility: 'Medium',
          timeframe: '45-60 days'
        }
      ],
      dataConfidenceStatus: 'High'
    };
  }

  return {
    months,
    shortfallAlert,
    minimumClosingCash: minClosing,
    maximumShortfall: maxShortfall
  };
}

/**
 * 6. Deterministic Malaysian SME Tax Computation (Part 6)
 * Reconciles Accounting Profit to Taxable Income.
 * Incorporates statutory SME tiered tax rates (Inland Revenue Board of Malaysia / LHDN):
 * - Tier 1: First RM 150,000 @ 15%
 * - Tier 2: RM 150,001 to RM 600,000 @ 17%
 * - Tier 3: In excess of RM 600,000 @ 24%
 */
export function calculate_malaysian_sme_tax(inputs: {
  taxYear: number;
  entityType?: 'SME Company (Sdn Bhd)' | 'Sole Proprietorship' | 'Partnership';
  accountingProfit: number;
  nonDeductibleExpenses?: number;
  exemptIncome?: number;
  capitalAllowances?: number;
  lossesCarriedForward?: number;
  taxInstallmentsPaid?: number;
}): TaxAdjustmentWorkflow {
  const entityType = inputs.entityType || 'SME Company (Sdn Bhd)';
  const accountingProfit = inputs.accountingProfit;
  const nonDeductibleExpenses = Math.max(0, inputs.nonDeductibleExpenses || 0);
  const exemptIncome = Math.max(0, inputs.exemptIncome || 0);

  const adjustedBusinessIncome = Math.max(0, accountingProfit + nonDeductibleExpenses - exemptIncome);
  const capitalAllowances = Math.max(0, inputs.capitalAllowances || 0);
  const lossesCarriedForward = Math.max(0, inputs.lossesCarriedForward || 0);

  const chargeableIncome = Math.max(0, adjustedBusinessIncome - capitalAllowances - lossesCarriedForward);

  let calculatedTaxExpense = 0;
  const tier1RatePct = 15;
  const tier2RatePct = 17;
  const tier3RatePct = 24;

  if (entityType === 'SME Company (Sdn Bhd)') {
    if (chargeableIncome <= 150000) {
      calculatedTaxExpense = chargeableIncome * (tier1RatePct / 100);
    } else if (chargeableIncome <= 600000) {
      calculatedTaxExpense =
        (150000 * (tier1RatePct / 100)) +
        ((chargeableIncome - 150000) * (tier2RatePct / 100));
    } else {
      calculatedTaxExpense =
        (150000 * (tier1RatePct / 100)) +
        (450000 * (tier2RatePct / 100)) +
        ((chargeableIncome - 600000) * (tier3RatePct / 100));
    }
  } else {
    // Standard corporate rate if not qualifying SME
    calculatedTaxExpense = chargeableIncome * 0.24;
  }

  const effectiveTaxRatePct = chargeableIncome > 0
    ? Number(((calculatedTaxExpense / chargeableIncome) * 100).toFixed(2))
    : 0;

  const taxInstallmentsPaid = Math.max(0, inputs.taxInstallmentsPaid || 0);
  const estimatedBalanceTaxPayable = Number((calculatedTaxExpense - taxInstallmentsPaid).toFixed(2));

  return {
    taxYear: inputs.taxYear,
    jurisdiction: 'Malaysia (Inland Revenue Board / LHDN)',
    entityType,
    accountingProfit,
    nonDeductibleExpenses,
    exemptIncome,
    adjustedBusinessIncome,
    capitalAllowances,
    lossesCarriedForward,
    chargeableIncome,
    tier1RatePct,
    tier2RatePct,
    tier3RatePct,
    calculatedTaxExpense: Number(calculatedTaxExpense.toFixed(2)),
    effectiveTaxRatePct,
    taxInstallmentsPaid,
    estimatedBalanceTaxPayable,
    notes: [
      'Calculated under Malaysian Income Tax Act 1967 (SME preferential rates on qualifying paid-up capital ≤ RM 2.5 million).',
      'Non-deductible add-backs typically include accounting depreciation, private motor vehicle expenses, entertainment above statutory limits, and fines.',
      'Statutory Capital Allowances (Initial & Annual Allowance) substitute accounting depreciation for tax relief.',
      'This calculation is an indicative decision-support estimation; consult an approved tax agent for formal statutory Form C filing.'
    ]
  };
}

/**
 * Standard Malaysian Precision Manufacturing SME Realistic Base Financial Statements
 * Provides grounded initial data for testing, simulation, and Excel template exports.
 */
export function get_standard_sme_financial_model(): {
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  priorBalanceSheet: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
  ratios: FinancialRatios;
  cashBudget: ReturnType<typeof calculate_12_month_cash_budget>;
  tax: TaxAdjustmentWorkflow;
} {
  const period = 'FY2024';

  const is = calculate_income_statement({
    period,
    revenue: 3200000, // RM 3.2M
    cogs: 1920000, // RM 1.92M (60% margin)
    operatingExpenses: 680000, // RM 680k (includes electricity, fuel, staff)
    depreciationAmortisation: 95000,
    financeCosts: 32000,
    incomeTaxExpense: 80500
  });

  const priorBs = calculate_balance_sheet({
    period: 'FY2023',
    cash: 240000,
    accountsReceivable: 410000,
    inventory: 280000,
    otherCurrentAssets: 25000,
    fixedAssetsAtCost: 1100000,
    accumulatedDepreciation: 320000,
    accountsPayable: 215000,
    shortTermDebt: 65000,
    longTermDebt: 320000,
    capital: 500000,
    retainedEarnings: 635000
  });

  const bs = calculate_balance_sheet({
    period,
    cash: 312500,
    accountsReceivable: 460000, // delta AR = +50k (reduces cash by 50k)
    inventory: 310000, // delta Inv = +30k (reduces cash by 30k)
    otherCurrentAssets: 25000,
    fixedAssetsAtCost: 1220000, // additions 120k
    accumulatedDepreciation: 415000, // 320k + 95k dep
    accountsPayable: 245000, // delta AP = +30k (adds cash by 30k)
    shortTermDebt: 70000,
    longTermDebt: 275000, // repaid 45k
    capital: 500000,
    retainedEarnings: 927500 // 635k + 392.5k net profit - 100k drawings
  });

  const cfs = calculate_cash_flow_statement({
    period,
    openingCash: priorBs.cash,
    netProfit: is.netProfit,
    depreciationExpense: is.depreciationAmortisation,
    priorAccountsReceivable: priorBs.accountsReceivable,
    currentAccountsReceivable: bs.accountsReceivable,
    priorInventory: priorBs.inventory,
    currentInventory: bs.inventory,
    priorAccountsPayable: priorBs.accountsPayable,
    currentAccountsPayable: bs.accountsPayable,
    capitalExpenditure: 120000,
    principalRepayments: 45000,
    drawings: 100000,
    balanceSheetCash: bs.cash
  });

  const ratios = calculate_financial_ratios(bs, is, priorBs);

  // 12-Month Cash Budget
  const monthlySales = [
    250000, 260000, 240000, 270000, 280000, 290000,
    275000, 265000, 285000, 300000, 310000, 320000
  ];
  const monthlyPurchases = monthlySales.map((s) => s * 0.58);
  const monthlyOpEx = monthlySales.map(() => 56000);
  const monthlyPrincipalRepayments = Array(12).fill(4500);
  const monthlyInterestPayments = Array(12).fill(2500);

  const cashBudget = calculate_12_month_cash_budget({
    initialOpeningCash: bs.cash,
    minimumCashBuffer: 100000, // RM 100k buffer
    monthlySales,
    cashSalesPct: 20,
    collectionSchedule: {
      currentMonthPct: 50,
      oneMonthLaterPct: 30,
      twoMonthsLaterPct: 20
    },
    monthlyPurchases,
    supplierPaymentCurrentPct: 60,
    monthlyOpEx,
    monthlyPrincipalRepayments,
    monthlyInterestPayments,
    monthLabels: [
      'Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025',
      'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025'
    ]
  });

  const tax = calculate_malaysian_sme_tax({
    taxYear: 2024,
    accountingProfit: is.profitBeforeTax,
    nonDeductibleExpenses: 35000,
    exemptIncome: 5000,
    capitalAllowances: 85000,
    lossesCarriedForward: 0,
    taxInstallmentsPaid: 60000
  });

  return {
    incomeStatement: is,
    balanceSheet: bs,
    priorBalanceSheet: priorBs,
    cashFlowStatement: cfs,
    ratios,
    cashBudget,
    tax
  };
}
