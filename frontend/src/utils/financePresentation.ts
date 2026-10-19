import { FinanceMetric } from '../services/finance';

export const financeAmount = (value: number | null | undefined) => value == null ? 'Not available'
  : new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(value);

export const financeMetric = (metric: FinanceMetric | undefined) => metric?.is_calculable && metric.value != null
  ? metric.formatted : 'Not available';
