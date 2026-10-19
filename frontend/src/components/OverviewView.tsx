import React from 'react';
import { ArrowRight, UploadCloud } from 'lucide-react';
import { useTransition } from '../context/TransitionContext';
import { useFinanceAnalysis } from '../hooks/useFinanceAnalysis';
import { FinanceResult } from '../services/finance';
import { TransitionTab } from '../types/transition';
import { financeAmount, financeMetric } from '../utils/financePresentation';
import { CarbonResult, carbonNumber, useCarbonAnalysis } from '../services/carbon';

export function OverviewSummary({ result, carbon, onNavigate }: {
  result: FinanceResult | null; carbon?: CarbonResult | null; onNavigate?: (page: TransitionTab) => void;
}) {
  return <>
    <div className="gb-metric-strip" aria-label="Financial summary">
      <div><span>Revenue</span><strong>{financeAmount(result?.inputs.revenue)}</strong></div>
      <div><span>EBITDA</span><strong>{financeAmount(result?.ebitda)}</strong></div>
      <div><span>Cash balance</span><strong>{financeAmount(result?.inputs.cash_balance)}</strong></div>
      <div><span>Debt-service coverage <small>(EBITDA basis)</small></span><strong>{financeMetric(result?.metrics.ebitda_debt_service_coverage)}</strong></div>
    </div>
    <div className="gb-overview-analysis">
      <article className="gb-panel"><h2>Financial analysis</h2>
        <p>{result ? `${result.company_id} · ${result.reporting_year}` : 'Your financial summary will appear after data review.'}</p>
        {result?.readiness.partial_accepted && <p>Some information is incomplete. Review the accepted limitations.</p>}
        <button className="gb-button gb-primary" onClick={() => onNavigate?.('financials')}>Review financial analysis <ArrowRight size={14} /></button>
      </article>
      <article className="gb-panel"><h2>Carbon analysis</h2><p>{carbon
        ? carbon.total_emissions == null ? 'Some activity is missing. Review your partial Carbon analysis.'
          : `${carbonNumber(carbon.total_emissions)} tCO₂e · ${carbon.reporting_year}`
        : 'Carbon analysis not available yet.'}</p>
        <button className="gb-button gb-primary" onClick={() => onNavigate?.('baseline')}>Review carbon analysis <ArrowRight size={14} /></button>
      </article>
    </div>
    <div className="gb-overview-next"><p>Review your analysis, then explore transition actions and ask AI Copilot for recommendations.</p>
      <button className="gb-button" onClick={() => onNavigate?.('actions')}>Explore transition actions <ArrowRight size={14} /></button></div>
  </>;
}

export const OverviewView: React.FC = () => {
  const { setActiveTab } = useTransition();
  const { result, message, busy, refresh } = useFinanceAnalysis();
  const carbon = useCarbonAnalysis();
  return <section className="gb-dashboard gb-analysis-overview" aria-label="Overview" aria-busy={busy}>
    <div className="gb-page-heading"><div><h1>Overview</h1><p>Review your business position before planning your transition.</p></div>
      <div className="gb-header-actions"><button className="gb-button" disabled={busy || carbon.busy} onClick={() => { refresh(); carbon.refresh(); }}>Refresh analysis</button>
        <button className="gb-button" onClick={() => setActiveTab('ingestion')}><UploadCloud size={14} /> Data &amp; Documents</button></div></div>
    {busy && <p role="status">Loading your analysis…</p>}
    {message && <p role="status">{message}</p>}
    {!busy && <OverviewSummary result={result} carbon={carbon.result} onNavigate={setActiveTab} />}
  </section>;
};
