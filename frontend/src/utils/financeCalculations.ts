import {
  Bill,
  CashAlert,
  CashProjectionPoint,
  Invoice,
  ScenarioPlan,
  ProposedAction
} from '../types/finance';

/**
 * Format integer sen into display string with currency code (e.g., 1800000 => "RM 18,000.00")
 */
export function formatMYR(sen: number, includeDecimals = true, currency = 'RM'): string {
  if (isNaN(sen)) return `${currency} 0.00`;
  const isNegative = sen < 0;
  const absSen = Math.abs(sen);
  const ringgit = Math.floor(absSen / 100);
  const cents = absSen % 100;

  const formattedRinggit = ringgit.toLocaleString('en-MY');
  const decimalsPart = includeDecimals ? `.${cents.toString().padStart(2, '0')}` : '';

  return `${isNegative ? '-' : ''}${currency} ${formattedRinggit}${decimalsPart}`;
}

export function formatMYRShort(sen: number, currency = 'RM'): string {
  if (isNaN(sen)) return `${currency} 0`;
  const isNegative = sen < 0;
  const absSen = Math.abs(sen);
  const ringgit = absSen / 100;

  if (ringgit >= 1000000) {
    return `${isNegative ? '-' : ''}${currency} ${(ringgit / 1000000).toFixed(1)}M`;
  }
  if (ringgit >= 1000) {
    return `${isNegative ? '-' : ''}${currency} ${(ringgit / 1000).toFixed(ringgit % 1000 === 0 ? 0 : 1)}k`;
  }
  return `${isNegative ? '-' : ''}${currency} ${ringgit.toFixed(0)}`;
}

export function parseMYRToSen(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }
  // Strip non-digit characters except period and negative sign
  const clean = value.toString().replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export interface ForecastOptions {
  initialCashSen: number;
  minReserveSen: number;
  forecastHorizonDays: number;
  bills: Bill[];
  invoices: Invoice[];
  collectedInvoices?: { invoiceId: string; dayIndex: number; amountSen: number }[];
  modifiedBillOffsets?: Record<string, number>;
  discretionaryExpenseCutSen?: number;
}

/**
 * Generates deterministic cash forecast across selectable horizon (7, 14, 30, 90 days)
 * strictly using uploaded bills, confirmed inflows, and real opening cash.
 */
export function generateCashForecast(options: ForecastOptions): CashProjectionPoint[] {
  const {
    initialCashSen,
    minReserveSen,
    forecastHorizonDays = 30,
    bills = [],
    invoices = [],
    collectedInvoices = [],
    modifiedBillOffsets = {},
    discretionaryExpenseCutSen = 0
  } = options;

  const projection: CashProjectionPoint[] = [];
  let currentRunningBalanceSen = initialCashSen;

  const today = new Date('2026-10-15T00:00:00Z');

  for (let day = 0; day <= forecastHorizonDays; day++) {
    const curDate = new Date(today);
    curDate.setDate(today.getDate() + day);
    const dateFormatted = curDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
    const rawDate = curDate.toISOString().slice(0, 10);
    const dateString = day === 0 ? 'Today (Day 0)' : `Day ${day} (${dateFormatted})`;

    const openingBalanceSen = currentRunningBalanceSen;
    let projectedInflowsSen = 0;
    let projectedOutflowsSen = 0;
    const inflowDetails: { description: string; amountSen: number; confirmed: boolean; recordId?: string }[] = [];
    const outflowDetails: { description: string; amountSen: number; recordId?: string }[] = [];

    // Confirmed inflows for this day (reconciled payment receipts)
    for (const collected of collectedInvoices) {
      if (collected.dayIndex === day) {
        projectedInflowsSen += collected.amountSen;
        inflowDetails.push({
          description: `Confirmed Payment (${collected.invoiceId})`,
          amountSen: collected.amountSen,
          confirmed: true,
          recordId: collected.invoiceId
        });
      }
    }

    // Outflows: real uploaded bills scheduled for this day
    for (const bill of bills) {
      if (bill.status === 'paid' || bill.status === 'deferred') continue;

      const effectiveDueOffset = modifiedBillOffsets[bill.id] !== undefined
        ? modifiedBillOffsets[bill.id]
        : bill.dueDayOffset;

      if (effectiveDueOffset === day) {
        let billAmount = bill.amountSen;
        if (bill.category?.toLowerCase().includes('discretionary') && discretionaryExpenseCutSen > 0) {
          billAmount = Math.max(0, billAmount - discretionaryExpenseCutSen);
        }

        projectedOutflowsSen += billAmount;
        outflowDetails.push({
          description: `${bill.vendorName} (${bill.description || bill.id})`,
          amountSen: billAmount,
          recordId: bill.id
        });
      }
    }

    const closingBalanceSen = openingBalanceSen + projectedInflowsSen - projectedOutflowsSen;
    currentRunningBalanceSen = closingBalanceSen;

    const isBreach = closingBalanceSen < minReserveSen;
    const breachAmountSen = isBreach ? minReserveSen - closingBalanceSen : 0;

    projection.push({
      dayIndex: day,
      dateString,
      rawDate,
      openingBalanceSen,
      projectedInflowsSen,
      projectedOutflowsSen,
      closingBalanceSen,
      minReserveSen,
      isBreach,
      breachAmountSen,
      inflowDetails,
      outflowDetails
    });
  }

  return projection;
}

/**
 * Analyzes forecast points and identifies exact cash risks & contributing records
 */
export function evaluateCashRisks(
  forecast: CashProjectionPoint[],
  minReserveSen: number,
  bills: Bill[] = [],
  invoices: Invoice[] = [],
  isConfigured = false
): CashAlert {
  if (!isConfigured && bills.length === 0 && invoices.length === 0) {
    return {
      id: 'ALERT-NO-DATA',
      severity: 'insufficient_data',
      title: 'Awaiting Financial Data Upload',
      breachDayIndex: -1,
      breachDate: 'N/A',
      lowestBalanceSen: 0,
      reserveDeficitSen: 0,
      shortDescription: 'No financial records have been uploaded yet. Upload your CSV, Excel, or PDF statements to generate an automated forecast.',
      rootCause: 'Data model empty. Requires accounts receivable, payables, or bank transaction records.',
      recommendedActionSummary: 'Upload financial files using the Upload tab to start monitoring cash flow.'
    };
  }

  if (forecast.length === 0) {
    return {
      id: 'ALERT-EMPTY',
      severity: 'insufficient_data',
      title: 'Insufficient Data for Forecast',
      breachDayIndex: -1,
      breachDate: 'N/A',
      lowestBalanceSen: 0,
      reserveDeficitSen: 0,
      shortDescription: 'Please confirm your opening cash balance and uploaded bills.',
      rootCause: 'No forecast points generated.',
      recommendedActionSummary: 'Check uploaded records in the Financial Data tab.'
    };
  }

  let lowestPoint = forecast[0];
  let firstBreachPoint: CashProjectionPoint | null = null;

  for (const point of forecast) {
    if (point.closingBalanceSen < lowestPoint.closingBalanceSen) {
      lowestPoint = point;
    }
    if (point.isBreach && !firstBreachPoint) {
      firstBreachPoint = point;
    }
  }

  // Find bills contributing to the breach (due on or before lowest point)
  const contributingBills = bills.filter(
    (b) => b.dueDayOffset <= lowestPoint.dayIndex && b.status !== 'paid'
  );
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');

  if (firstBreachPoint || lowestPoint.closingBalanceSen < minReserveSen) {
    const breachDay = firstBreachPoint ? firstBreachPoint.dayIndex : lowestPoint.dayIndex;
    const breachDate = firstBreachPoint ? firstBreachPoint.dateString : lowestPoint.dateString;
    const deficitBelowReserve = minReserveSen - lowestPoint.closingBalanceSen;
    const severity: 'critical' | 'warning' = lowestPoint.closingBalanceSen < 0 ? 'critical' : 'warning';

    const billsTotalSen = contributingBills.reduce((acc, b) => acc + b.amountSen, 0);
    const overdueTotalSen = overdueInvoices.reduce((acc, i) => acc + i.amountSen, 0);

    const rootCause = lowestPoint.closingBalanceSen < 0
      ? `Projected commitments of ${formatMYR(billsTotalSen)} fall due before uncollected receivables (${formatMYR(overdueTotalSen)}) are settled, causing balance to dip to ${formatMYR(lowestPoint.closingBalanceSen)} on ${lowestPoint.dateString}.`
      : `Cash level drops below your safety reserve threshold of ${formatMYR(minReserveSen)} on ${breachDate}.`;

    return {
      id: 'ALERT-RISK',
      severity,
      title: severity === 'critical' ? 'Projected Cash Deficit Detected' : 'Cash Reserve Warning',
      breachDayIndex: breachDay,
      breachDate,
      lowestBalanceSen: lowestPoint.closingBalanceSen,
      reserveDeficitSen: deficitBelowReserve,
      shortDescription: `Cash projected to reach ${formatMYR(lowestPoint.closingBalanceSen)} on ${lowestPoint.dateString} (${formatMYR(deficitBelowReserve)} below safety reserve).`,
      rootCause,
      recommendedActionSummary: overdueInvoices.length > 0
        ? `Prioritize collection of ${overdueInvoices.length} overdue invoice(s) totaling ${formatMYR(overdueTotalSen)}.`
        : `Consider negotiating payment terms for upcoming obligations totaling ${formatMYR(billsTotalSen)}.`,
      contributingBills,
      contributingInvoices: overdueInvoices
    };
  }

  return {
    id: 'ALERT-HEALTHY',
    severity: 'healthy',
    title: 'Cash Flow Healthy & Safe',
    breachDayIndex: -1,
    breachDate: 'N/A',
    lowestBalanceSen: lowestPoint.closingBalanceSen,
    reserveDeficitSen: 0,
    shortDescription: `All days in horizon maintain positive liquidity. Lowest projected balance is ${formatMYR(lowestPoint.closingBalanceSen)}, preserving your safety reserve.`,
    rootCause: 'All upcoming supplier obligations are covered by confirmed cash balances.',
    recommendedActionSummary: 'Continue ongoing surveillance as new vendor bills and invoices are received.'
  };
}

/**
 * Builds candidate scenario plans based dynamically on real uploaded records
 */
export function buildRealDataScenarios(
  baseOptions: ForecastOptions,
  planACollectionDay = 5,
  planBExtensionDays = 14,
  planCCutSen = 100000
): ScenarioPlan[] {
  const { initialCashSen, minReserveSen, bills, invoices } = baseOptions;

  if (bills.length === 0 && invoices.length === 0) {
    return [];
  }

  // Find top overdue invoice to prioritize
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue' || i.daysOverdue > 0);
  const targetInvoice = overdueInvoices.sort((a, b) => b.amountSen - a.amountSen)[0] || invoices[0];

  // Find largest upcoming bill to negotiate
  const unpaidBills = bills.filter((b) => b.status !== 'paid');
  const targetBill = unpaidBills.sort((a, b) => b.amountSen - a.amountSen)[0] || bills[0];

  // Plan A: Prioritize Collection of highest receivable
  const collectedInflowsA = targetInvoice
    ? [{ invoiceId: targetInvoice.id, dayIndex: planACollectionDay, amountSen: targetInvoice.amountSen }]
    : [];

  const forecastPlanA = generateCashForecast({
    ...baseOptions,
    collectedInvoices: collectedInflowsA
  });

  let lowA = forecastPlanA[0] || { closingBalanceSen: 0, dayIndex: 0 };
  for (const pt of forecastPlanA) {
    if (pt.closingBalanceSen < lowA.closingBalanceSen) lowA = pt;
  }
  const breachA = Math.max(0, minReserveSen - lowA.closingBalanceSen);

  // Plan B: Extend largest supplier bill
  const modifiedOffsetsPlanB: Record<string, number> = {};
  if (targetBill) {
    modifiedOffsetsPlanB[targetBill.id] = (targetBill.dueDayOffset || 10) + planBExtensionDays;
  }
  const forecastPlanB = generateCashForecast({
    ...baseOptions,
    modifiedBillOffsets: modifiedOffsetsPlanB
  });
  let lowB = forecastPlanB[0] || { closingBalanceSen: 0, dayIndex: 0 };
  for (const pt of forecastPlanB) {
    if (pt.closingBalanceSen < lowB.closingBalanceSen) lowB = pt;
  }
  const breachB = Math.max(0, minReserveSen - lowB.closingBalanceSen);

  // Plan C: Partial collection (50%) + discretionary reduction
  const collectedInflowsC = targetInvoice
    ? [{ invoiceId: targetInvoice.id, dayIndex: Math.min(8, planACollectionDay + 3), amountSen: Math.round(targetInvoice.amountSen * 0.5) }]
    : [];

  const forecastPlanC = generateCashForecast({
    ...baseOptions,
    collectedInvoices: collectedInflowsC,
    discretionaryExpenseCutSen: planCCutSen
  });
  let lowC = forecastPlanC[0] || { closingBalanceSen: 0, dayIndex: 0 };
  for (const pt of forecastPlanC) {
    if (pt.closingBalanceSen < lowC.closingBalanceSen) lowC = pt;
  }
  const breachC = Math.max(0, minReserveSen - lowC.closingBalanceSen);

  const planA: ScenarioPlan = {
    id: 'PLAN_A',
    code: 'Plan A',
    name: 'Prioritize Overdue Receivable Collection',
    strategySummary: targetInvoice
      ? `Accelerate collection of ${targetInvoice.id} (${formatMYR(targetInvoice.amountSen)}) from ${targetInvoice.customerName} on or before Day ${planACollectionDay}.`
      : 'Collect outstanding customer receivables promptly.',
    lowestBalanceSen: lowA.closingBalanceSen,
    lowestBalanceDay: lowA.dayIndex,
    reserveBreachSen: breachA,
    financialImpactSen: targetInvoice ? targetInvoice.amountSen : 0,
    operationalRisk: 'Low',
    assumptions: [
      targetInvoice
        ? `Assumes ${targetInvoice.customerName} settles ${formatMYR(targetInvoice.amountSen)} upon receiving formal payment notice.`
        : 'Assumes prompt customer settlement.',
      'Maintains regular supplier payment schedules without vendor term alteration.'
    ],
    recommended: breachA <= breachB,
    whyRecommended: 'Focuses on recovering earned revenue without incurring vendor relationship friction or supply chain delays.',
    targetCollectionDayOffset: planACollectionDay,
    actions: targetInvoice
      ? [
          {
            id: `ACT-${targetInvoice.id}`,
            title: `Send Payment Notice for ${targetInvoice.id}`,
            purpose: `Recover ${formatMYR(targetInvoice.amountSen)} from ${targetInvoice.customerName} (${targetInvoice.daysOverdue > 0 ? `${targetInvoice.daysOverdue}d overdue` : 'due soon'}).`,
            targetEntity: targetInvoice.customerName,
            referenceId: targetInvoice.id,
            amountSen: targetInvoice.amountSen,
            recipientContact: targetInvoice.customerContact || 'Finance Department',
            recipientEmail: targetInvoice.customerEmail || 'accounts@client.com',
            expectedEffect: `Increases cleared cash by ${formatMYR(targetInvoice.amountSen)}.`,
            riskLevel: 'Low',
            requiresHumanApproval: true,
            status: 'Pending Approval',
            preparedDate: '2026-10-15',
            draftMessageSubject: `Payment Notice: Settlement for Invoice ${targetInvoice.id} (${formatMYR(targetInvoice.amountSen)})`,
            draftMessageBody: `Dear ${targetInvoice.customerContact || 'Accounts Team'},\n\nWe are following up regarding Invoice ${targetInvoice.id} for ${formatMYR(targetInvoice.amountSen)}.\n\nWe kindly request settlement at your earliest convenience to maintain an updated account statement.\n\nThank you for your prompt assistance.\n\nWarm regards,\nFinance Operations Team`
          }
        ]
      : []
  };

  const planB: ScenarioPlan = {
    id: 'PLAN_B',
    code: 'Plan B',
    name: 'Supplier Payment Terms Extension',
    strategySummary: targetBill
      ? `Negotiate a ${planBExtensionDays}-day postponement for bill ${targetBill.id} (${formatMYR(targetBill.amountSen)}) with ${targetBill.vendorName}.`
      : 'Negotiate supplier extension.',
    lowestBalanceSen: lowB.closingBalanceSen,
    lowestBalanceDay: lowB.dayIndex,
    reserveBreachSen: breachB,
    financialImpactSen: targetBill ? targetBill.amountSen : 0,
    operationalRisk: 'Medium',
    assumptions: [
      targetBill
        ? `Assumes ${targetBill.vendorName} agrees to extend due date by ${planBExtensionDays} days without service interruption.`
        : 'Assumes supplier agrees to extension.'
    ],
    recommended: breachB < breachA,
    whyRecommended: 'Temporarily halts cash outflow if client collection proves delayed.',
    supplierExtensionDays: planBExtensionDays,
    actions: targetBill
      ? [
          {
            id: `ACT-EXT-${targetBill.id}`,
            title: `Request ${planBExtensionDays}-Day Term Extension for ${targetBill.id}`,
            purpose: `Postpone payable of ${formatMYR(targetBill.amountSen)} to ${targetBill.vendorName}.`,
            targetEntity: targetBill.vendorName,
            referenceId: targetBill.id,
            amountSen: targetBill.amountSen,
            recipientContact: targetBill.vendorContact || 'Accounts Payable',
            expectedEffect: `Defers ${formatMYR(targetBill.amountSen)} outflow by ${planBExtensionDays} days.`,
            riskLevel: 'Medium',
            requiresHumanApproval: true,
            status: 'Draft',
            preparedDate: '2026-10-15'
          }
        ]
      : []
  };

  const planC: ScenarioPlan = {
    id: 'PLAN_C',
    code: 'Plan C',
    name: 'Contingency: Partial Collection & Expense Pause',
    strategySummary: targetInvoice
      ? `Seek 50% partial payment (${formatMYR(Math.round(targetInvoice.amountSen * 0.5))}) from ${targetInvoice.customerName} while curbing ${formatMYR(planCCutSen)} in discretionary spending.`
      : 'Partial collection and expense curb.',
    lowestBalanceSen: lowC.closingBalanceSen,
    lowestBalanceDay: lowC.dayIndex,
    reserveBreachSen: breachC,
    financialImpactSen: (targetInvoice ? Math.round(targetInvoice.amountSen * 0.5) : 0) + planCCutSen,
    operationalRisk: 'Medium',
    assumptions: [
      'Customer agrees to an immediate partial payment tranche.',
      'Non-essential operational spending can be paused without impairing core business.'
    ],
    recommended: false,
    discretionaryCutSen: planCCutSen,
    actions: []
  };

  return [planA, planB, planC];
}
