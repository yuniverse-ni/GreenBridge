import React from 'react';
import { useTransition } from '../context/TransitionContext';
import { useFinanceAnalysis } from '../hooks/useFinanceAnalysis';
import { FinanceResult } from '../services/finance';
import { financeAmount, financeMetric } from '../utils/financePresentation';

const label = (value: string) => value.replace(/_/g, ' ').replace(/^./, text => text.toUpperCase());
const Fact = ({ name, value, reason }: { name: string; value: string; reason?: string }) =>
  <div><dt>{name}{reason && <small>{reason}</small>}</dt><dd>{value}</dd></div>;

/** Interprets server facts for display; no local financial calculations. */
export function FinanceResultPanel({ result }: { result: FinanceResult }) {
  const input = result.inputs;
  return <>
    <p className="gb-analysis-period">{result.company_id} · {result.reporting_year}
      {result.readiness.partial_accepted && ' · PARTIAL — limitations explicitly accepted'}</p>
    <div className="gb-finance-sections">
      <section className="gb-panel"><h2>Performance</h2><dl className="gb-financial-facts">
        <Fact name="Revenue" value={financeAmount(input.revenue)} />
        <Fact name="Gross profit" value={financeAmount(result.gross_profit)} />
        <Fact name="EBITDA" value={financeAmount(result.ebitda)} reason={result.ebitda == null ? 'Revenue, COGS and operating expenses are needed.' : undefined} />
        <Fact name="EBITDA margin" value={financeMetric(result.metrics.ebitda_margin)} />
      </dl>{result.ebitda != null && <p className="gb-finance-note">{result.ebitda < 0
        ? 'Operating costs exceed income before financing and tax.' : 'Operating earnings are positive or break even before financing and tax.'}</p>}</section>
      <section className="gb-panel"><h2>Liquidity &amp; Debt</h2><dl className="gb-financial-facts">
        <Fact name="Cash balance" value={financeAmount(input.cash_balance)} />
        <Fact name="Reported operating cash flow" value={financeAmount(input.operating_cash_flow)} />
        <Fact name="Total debt" value={financeAmount(input.total_debt)} />
        <Fact name="Current liabilities" value={financeAmount(input.current_liabilities)} />
        <Fact name="Annual debt service" value={financeAmount(input.annual_debt_service)} />
        <Fact name="Cash ratio" value={financeMetric(result.metrics.cash_ratio)} />
        <Fact name="Debt-service coverage (EBITDA basis)" value={financeMetric(result.metrics.ebitda_debt_service_coverage)} />
      </dl></section>
      <section className="gb-panel"><h2>Transition Capacity</h2><dl className="gb-financial-facts">
        <Fact name="Declared CAPEX budget" value={financeAmount(input.capex_budget)} />
        <Fact name="Minimum cash reserve" value={financeAmount(input.minimum_cash_reserve)} />
        <Fact name="Cash above reserve" value={financeAmount(result.cash_above_reserve)} />
        <Fact name="CFADS-based DSCR" value="Not available" reason="Verified cash available for debt payments is needed." />
        <Fact name="Loan capacity" value="Not available" reason="Additional cash-flow evidence and lending terms are needed." />
      </dl>{result.cash_above_reserve != null && result.cash_above_reserve < 0 && <p className="gb-finance-note">Cash is below your declared minimum reserve.</p>}</section>
    </div>
    <details className="gb-panel gb-finance-details"><summary>View details</summary>
      <h3>Calculated indicators</h3><dl className="gb-financial-facts">
        {Object.entries(result.metrics).map(([name, metric]) => <Fact key={name} name={label(name)}
          value={financeMetric(metric)} reason={`${metric.formula}. ${metric.explanation}`} />)}
      </dl><h3>Information &amp; evidence limitations</h3>
      <ul>{result.evidence_limitations.map(text => <li key={text}>{text}</li>)}</ul>
      <h3>Supplied financial values</h3><dl className="gb-financial-facts">
        {Object.entries(input).map(([field, value]) => <Fact key={field} name={label(field)} value={financeAmount(value)} />)}
      </dl>
    </details>
  </>;
}

export const FinancialAnalysisView: React.FC = () => {
  const { setActiveTab } = useTransition();
  const { result, message, busy, refresh } = useFinanceAnalysis();
  return <section className="gb-financial-analysis" aria-labelledby="financial-analysis-heading" aria-busy={busy}>
    <div className="gb-page-heading"><div><h1 id="financial-analysis-heading">Financial Analysis</h1>
      <p>Understand your performance, cash position and capacity to invest.</p></div>
      <button type="button" className="gb-button" disabled={busy} onClick={refresh}>Refresh analysis</button>
    </div>
    {busy && <p role="status">Loading financial analysis…</p>}
    {message && <div className="gb-panel gb-finance-empty" role="status"><p>{message}</p>
      <button className="gb-button" onClick={() => setActiveTab('ingestion')}>Review Data &amp; Documents</button></div>}
    {result && <FinanceResultPanel result={result} />}
    <div className="gb-financial-next"><button className="gb-button" onClick={() => setActiveTab('overview')}>Back to Overview</button>
      {result && <><button className="gb-button" onClick={() => setActiveTab('copilot')}>AI Copilot</button>
        <button className="gb-button gb-primary" onClick={() => setActiveTab('actions')}>Explore transition actions</button></>}
    </div>
  </section>;
};
