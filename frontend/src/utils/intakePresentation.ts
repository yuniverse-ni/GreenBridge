import { IntakeModule, IntakeResult } from '../services/intake';

interface IssueGroup { title: string; messages: string[] }
interface ModuleSummary { module: IntakeModule; groups: IssueGroup[] }

/** Summarize repeated text without merging different error meanings. */
function groupedMessages(messages: string[], fields: string[]): string[] {
  const groups = new Map<string, Set<string>>();
  for (const message of new Set(messages)) {
    let template = message;
    for (const field of fields) template = template.replaceAll(field, 'a field');
    if (!groups.has(template)) groups.set(template, new Set());
    groups.get(template)!.add(message);
  }
  return [...groups].map(([message, originals]) => originals.size > 1 ? `${message} (${originals.size} affected fields)` : message);
}

/** Display aggregation only: never changes the published result or permissions. */
export function intakeTechnicalSummary(result: IntakeResult) {
  const dataset = result.normalized_data;
  const handled = new Set<number>();
  const fields = dataset ? [...Object.keys(dataset.metadata), ...Object.keys(dataset.financial), ...Object.keys(dataset.activity)] : [];
  const qualityFields = (keys: string[], quality: string) => new Set([
    ...result.evidence.filter(item => keys.includes(item.field) && item.evidence_quality === quality).map(item => item.field),
    ...keys.filter(field => dataset?.provenance[field]?.some(source => (source as { evidence_quality?: string }).evidence_quality === quality)),
  ]).size;
  const countText = (count: number, singular: string) => `${count} ${singular}${count === 1 ? '' : 's'}`;
  const modules: ModuleSummary[] = (['carbon_analysis', 'financial_analysis', 'transition_analysis'] as IntakeModule[]).map(module => {
    if (module === 'transition_analysis') return { module, groups: [{ title: 'Readiness dependency', messages: ['Depends on available Carbon and Finance data.'] }] };
    const carbon = module === 'carbon_analysis';
    const keys = Object.keys((carbon ? dataset?.activity : dataset?.financial) ?? {});
    const kind = carbon ? 'carbon field' : 'financial field';
    const groups: IssueGroup[] = [];
    const add = (title: string, message: string) => {
      let group = groups.find(item => item.title === title);
      if (!group) { group = { title, messages: [] }; groups.push(group); }
      if (!group.messages.includes(message)) group.messages.push(message);
    };
    for (const [gapType, prefix] of [['MISSING_PERIOD', 'Missing'], ['INCOMPLETE_PERIOD', 'Incomplete']] as const) {
      const affected = new Set<string>();
      result.data_gaps.forEach((gap, index) => {
        if (gap.gap_type === gapType && gap.affected_field && keys.includes(gap.affected_field)) {
          affected.add(gap.affected_field); handled.add(index);
        }
      });
      if (affected.size) {
        const records = new Set(result.evidence.filter(item => affected.has(item.field) && !item.reporting_period)
          .map(item => JSON.stringify([item.field, item.source_document_id, item.source_file, item.sheet, item.row, item.original_column]))).size;
        add('Reporting period', `${prefix} for ${gapType === 'MISSING_PERIOD' && records
          ? countText(records, 'activity record') : countText(affected.size, kind)}.`);
      }
    }
    for (const [quality, description] of [['UNKNOWN', 'Undeclared'], ['ESTIMATED_PROXY', 'Estimated / proxy evidence']] as const) {
      const count = qualityFields(keys, quality);
      if (count) add('Evidence quality', `${description} for ${countText(count, kind)}.`);
    }
    const missing = new Set<string>();
    result.data_gaps.forEach((gap, index) => {
      if (gap.gap_type === 'MISSING_FINANCIAL' && !carbon && gap.affected_field && keys.includes(gap.affected_field)) {
        missing.add(gap.affected_field); handled.add(index);
      }
      if (carbon && gap.gap_type === 'MISSING_ACTIVITY') { add('Activity records', 'No energy or fuel evidence is available.'); handled.add(index); }
      if (carbon && gap.gap_type === 'ACTIVITY_APPLICABILITY' && dataset) {
        const count = Object.values(dataset.activity).filter(value => value == null).length;
        add('Activity coverage', count ? `${countText(count, 'activity category')} missing; applicability needs review.` : gap.message);
        handled.add(index);
      }
    });
    if (missing.size) add('Financial information', `Missing ${countText(missing.size, 'financial field')}.`);
    return { module, groups };
  });
  const shared: IssueGroup[] = [];
  for (const [quality, description] of [['UNKNOWN', 'Undeclared'], ['ESTIMATED_PROXY', 'Estimated / proxy evidence']] as const) {
    const count = qualityFields(['company_id', 'reporting_year'], quality);
    if (count) shared.push({ title: 'Business details', messages: [`${description} for ${countText(count, 'business field')}.`] });
    if (qualityFields(fields, quality)) result.data_gaps.forEach((gap, index) => {
      if (gap.gap_type === (quality === 'UNKNOWN' ? 'UNKNOWN_EVIDENCE_QUALITY' : 'ESTIMATED_EVIDENCE')) handled.add(index);
    });
  }
  const missingContext = result.data_gaps.filter(gap => gap.gap_type === 'MISSING_CONTEXT');
  if (missingContext.length) {
    shared.push({ title: 'Business details', messages: [`${new Set(missingContext.map(gap => gap.affected_field)).size} required business fields missing.`] });
    result.data_gaps.forEach((gap, index) => { if (gap.gap_type === 'MISSING_CONTEXT') handled.add(index); });
  }
  const remainingGaps = new Map<string, { message: string; affected: Set<string> }>();
  result.data_gaps.forEach((gap, index) => {
    if (handled.has(index)) return;
    let message = `${gap.severity}: ${gap.message}`;
    for (const field of fields) message = message.replaceAll(field, 'a field');
    const key = `${gap.gap_type}:${message}`;
    if (!remainingGaps.has(key)) remainingGaps.set(key, { message, affected: new Set() });
    if (gap.affected_field) remainingGaps.get(key)!.affected.add(gap.affected_field);
  });
  const otherMessages = [...remainingGaps.values()].map(({ message, affected }) => affected.size
    ? `${message} (${countText(affected.size, 'affected field')})` : message);
  // Known reasons are already represented by the counted groups above. Retain
  // unfamiliar reasons, including future validation conditions, in the summary.
  const coveredReason = /^(Source quality for .+ is unknown or estimated; not externally verified\.|Company\/reporting-year source quality is unknown or estimated\.|Missing context:|Missing financial fields:|No energy or fuel evidence is available\.|Some activity categories are missing;|Required structured activity\/context fields|Required financial\/context fields|Depends on carbon and financial data readiness;)/;
  for (const module of Object.keys(result.readiness) as IntakeModule[]) {
    otherMessages.push(...result.readiness[module].reasons.filter(reason => !coveredReason.test(reason)
      && !result.data_gaps.some(gap => gap.message === reason)));
  }
  const remaining = groupedMessages(otherMessages, fields);
  if (remaining.length) shared.push({ title: 'Other checks', messages: remaining });
  const errors = groupedMessages(result.errors.map(error => `${error.stage}: ${error.message}`), fields);
  const notices = groupedMessages(result.notices, fields);
  const mergedShared = new Map<string, Set<string>>();
  for (const group of shared) {
    if (!mergedShared.has(group.title)) mergedShared.set(group.title, new Set());
    group.messages.forEach(message => mergedShared.get(group.title)!.add(message));
  }
  return { modules, shared: [...mergedShared].map(([title, messages]) => ({ title, messages: [...messages] })), errors, notices };
}
