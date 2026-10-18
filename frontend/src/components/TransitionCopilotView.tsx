import React, { useState, useRef, useEffect } from 'react';
import { useTransition } from '../context/TransitionContext';
import { formatCurrency } from '../utils/transitionCalculations';
import { Send, ArrowRight } from 'lucide-react';
import { CopilotAdvisor } from './CopilotAdvisor';

const QUICK_QUESTIONS = [
  'Why this pathway?',
  'Can I afford it?',
  'What should I watch out for?',
];

export const TransitionCopilotView: React.FC = () => {
  const {
    copilotMessages, isCopilotLoading, sendCopilotMessage, profile,
    allActions, selectedActionIds, setActiveTab, activityRecords,
  } = useTransition();
  const [inputMessage, setInputMessage] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const panel = historyRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [copilotMessages, isCopilotLoading]);

  // Preserve the existing deterministic selection; this view only presents it.
  const priorities = { High: 0, Medium: 1, Low: 2 };
  const ranked = [...allActions].sort((a, b) =>
    priorities[a.recommendedPriority] - priorities[b.recommendedPriority]
    || b.annualCO2eReductionTons - a.annualCO2eReductionTons
    || a.id.localeCompare(b.id)
  );
  const recommended = activityRecords.length
    ? ranked.find(action => selectedActionIds.includes(action.id))
    : undefined;
  // Hide the legacy greeting without deleting or changing conversation state.
  const conversation = copilotMessages.filter(message => message.id !== 'MSG-INIT');
  const warnings = recommended ? [
    recommended.id.includes('SOLAR')
      ? 'Roof suitability needs verification'
      : 'Projected savings need verification',
    'Scope 3 unavailable',
  ] : [];

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputMessage.trim() || isCopilotLoading) return;
    const message = inputMessage;
    setInputMessage('');
    await sendCopilotMessage(message);
  };

  return (
    <section className="gb-focused-copilot" aria-label="AI Copilot">
      <article className="gb-advice-widget" aria-labelledby="recommendation-heading">
        <h1 id="recommendation-heading">AI Recommendation</h1>
        <div className="gb-advice-presentation">
          <CopilotAdvisor />
          <div className="gb-consultant-bubble">
            {recommended ? (
              <>
                <span className="gb-pathway-label">Recommended pathway</span>
                <h2>{recommended.title}</h2>
                <p>I'd start here: it leads your selected actions on priority, with carbon reduction breaking ties.</p>
              </>
            ) : (
              <p className="gb-advice-empty">Load your business data and select transition actions. I'll help you identify the most suitable pathway.</p>
            )}
          </div>
        </div>
        {recommended && (
          <div className="gb-advice-details">
            <dl className="gb-advice-metrics">
              <div><dt>Carbon reduction</dt><dd>{recommended.annualCO2eReductionTons}<small>tCO2e / year</small></dd></div>
              <div><dt>Annual savings</dt><dd>{formatCurrency(recommended.annualOpExSavings, profile.currency)}</dd></div>
              <div><dt>Payback</dt><dd>{recommended.paybackPeriodYears}<small>years</small></dd></div>
            </dl>
            <div className="gb-advice-warnings" aria-label="Key considerations">
              {warnings.map(warning => <span key={warning}>{warning}</span>)}
            </div>
            <button className="gb-button gb-primary gb-pathway-cta" onClick={() => setActiveTab('actions')}>
              Review pathway <ArrowRight size={15} />
            </button>
          </div>
        )}
      </article>

      <article className="gb-ask-widget" aria-labelledby="ask-copilot-heading">
        <h2 id="ask-copilot-heading">Ask Your Copilot</h2>
        <div className="gb-focused-history" ref={historyRef} role="log" aria-live="polite" aria-label="Copilot conversation" tabIndex={0}>
          {!conversation.length && (
            <div className="gb-conversation-entry gb-conversation-advisor">
              <CopilotAdvisor variant="avatar" />
              <div className="gb-conversation-bubble"><p>What would you like to know about this recommendation?</p></div>
            </div>
          )}
          {conversation.map(message => (
            <div className={`gb-conversation-entry ${message.sender === 'user' ? 'gb-conversation-owner' : 'gb-conversation-advisor'}`} key={message.id}>
              {message.sender === 'assistant' && <CopilotAdvisor variant="avatar" />}
              <div className="gb-conversation-bubble">
                <span className="gb-conversation-speaker">{message.sender === 'user' ? 'You' : 'GreenBridge advisor'}</span>
                <p>{message.text}</p>
                <time>{message.timestamp}</time>
              </div>
            </div>
          ))}
          {isCopilotLoading && <p className="gb-copilot-thinking" role="status">Your advisor is thinking...</p>}
        </div>
        <div className="gb-quick-questions" aria-label="Quick questions">
          {QUICK_QUESTIONS.map(question => (
            <button key={question} onClick={() => { setInputMessage(question); inputRef.current?.focus(); }}>{question}</button>
          ))}
        </div>
        <form className="gb-focused-form" onSubmit={handleSend}>
          <input ref={inputRef} aria-label="Ask your Copilot a question" value={inputMessage} onChange={event => setInputMessage(event.target.value)} placeholder="Ask about this decision..." />
          <button type="submit" className="gb-button gb-primary" aria-label="Send question" disabled={!inputMessage.trim() || isCopilotLoading}><Send size={16} /></button>
        </form>
      </article>
    </section>
  );
};
