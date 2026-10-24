import type { ObservationGroup, SetMember } from '../types/caremodels';

export const isNumericDatatype = (datatype?: SetMember['datatype'] | null) => datatype === 'NUMERIC';

/** Display one typed member value; never coerces or invents precision. */
export function formatSetMemberValue(member: SetMember): string {
  if (member.value == null) return '—';
  if (member.datatype === 'CODED' && typeof member.value === 'object') return member.value.display ?? '—';
  if (member.datatype === 'BOOLEAN') return member.value === true ? 'Yes' : 'No';
  if (member.datatype === 'DATE' || member.datatype === 'DATETIME') return formatSetDate(String(member.value));
  const qualifier = member.qualifier && member.qualifier !== '=' ? member.qualifier : '';
  return `${qualifier}${member.value}`;
}

export function formatReferenceRange(range?: SetMember['referenceRange']): string {
  if (!range) return '';
  const { low, high } = range;
  if (low != null && high != null) return `${trimNumber(low)} – ${trimNumber(high)}`;
  if (high != null) return `≤ ${trimNumber(high)}`;
  if (low != null) return `≥ ${trimNumber(low)}`;
  return '';
}

function trimNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : '';
}

export function formatSetDate(value?: string | null): string {
  if (!value) return '—';
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString() : value;
}

/** All recorded observations of one member concept inside a group, in recorded order. */
export function memberValues(group: ObservationGroup, conceptUuid: string): Array<SetMember> {
  return group.members.filter((member) => member.conceptUuid === conceptUuid);
}

/** Configured member entries for a set widget (properties.members), already in display order. */
export interface SetMemberConfig {
  conceptUuid: string;
  label: string;
  inTable: boolean;
  inChart?: boolean;
}

export function configuredMembers(properties: Record<string, unknown> | undefined): Array<SetMemberConfig> {
  const members = properties?.members;
  return Array.isArray(members) ? (members as Array<SetMemberConfig>).filter((member) => isRecord(member)) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Members to display for a group. Widget configuration selects and orders the rows; unknown
 * configured members stay visible as missing rows rather than being silently dropped.
 */
export function displayRows(
  group: ObservationGroup | undefined,
  members: Array<SetMemberConfig>,
  showMissing: boolean,
): Array<{ label: string; values: Array<SetMember> }> {
  const rows: Array<{ label: string; values: Array<SetMember> }> = [];
  for (const config of members) {
    if (!config.inTable) continue;
    const values = group ? memberValues(group, config.conceptUuid) : [];
    if (!values.length && !showMissing) continue;
    rows.push({ label: config.label, values });
  }
  return rows;
}

/** Default member rows from a group's own recorded members, in resolver (set) order. */
export function rowsFromGroup(group: ObservationGroup): Array<{ label: string; values: Array<SetMember> }> {
  const seen = new Map<string, { label: string; values: Array<SetMember> }>();
  for (const member of group.members) {
    const key = member.conceptUuid ?? member.obsUuid;
    const existing = seen.get(key);
    if (existing) existing.values.push(member);
    else
      seen.set(key, {
        label: member.conceptDisplay ?? key,
        values: [member],
      });
  }
  return Array.from(seen.values());
}

/** Range filter for history groups; anchored at the newest recorded group, not at today. */
export function rangeCutoff(newest: string | undefined, range: string): number | null {
  const days: Record<string, number> = { '6m': 183, '1y': 365, '2y': 730, '5y': 1825 };
  if (!newest || !(range in days)) return null;
  const anchor = Date.parse(newest);
  return Number.isFinite(anchor) ? anchor - days[range] * 86400000 : null;
}
