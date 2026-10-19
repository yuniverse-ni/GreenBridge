import { useEffect, useState } from 'react';
import { FinanceResult, getFinance } from '../services/finance';
import { savedIntake } from '../services/intake';

/** Both finance screens load the same server-owned result; never start an agent. */
export function useFinanceAnalysis() {
  const [result, setResult] = useState<FinanceResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const intake = savedIntake();
    setResult(null); setMessage(null);
    if (!intake) {
      setBusy(false);
      setMessage('Upload and analyse your business data in Data & Documents to see your analysis.');
      return;
    }
    setBusy(true);
    getFinance(intake).then(response => {
      if (!active) return;
      setResult(response.data);
      if (!response.data) setMessage(response.missing_context.some(text => text.includes('SERVICE_UNAVAILABLE'))
        ? 'Financial analysis is not available yet. Please try again later.'
        : 'Review Data & Documents and resolve or explicitly accept the outstanding information.');
    }).catch(() => {
      if (active) setMessage('We could not load your analysis. Try again, or review your upload in Data & Documents.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [revision]);
  return { result, message, busy, refresh: () => setRevision(value => value + 1) };
}
