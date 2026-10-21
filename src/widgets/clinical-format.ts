import type { ObservationField } from './widget-properties';
import type { DataResult } from '../types/caremodels';
export type ObservationValue = NonNullable<DataResult['values']>[number];

/** No numeric coercion: a qualified string such as <50 remains a qualified string. */
export function formatClinicalValue(value: ObservationValue, precision?: number): string {
  if (value.value == null) return '—';
  if (value.valueName) return value.valueName;
  if (value.valueType === 'NUMBER' && typeof value.value === 'number')
    return precision === undefined ? String(value.value) : value.value.toFixed(precision);
  if (value.valueType === 'DATE') return formatClinicalDate(String(value.value));
  return String(value.value);
}
export function formatClinicalDate(value?: string): string {
  if (!value) return '—';
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString() : value;
}
export function sortedObservations(
  values: Array<ObservationValue>,
  descending = false,
  field: ObservationField = 'effectiveTime',
): Array<ObservationValue> {
  return [...values].sort((a, b) => {
    let difference = 0;
    if (field === 'effectiveTime') {
      const aTime = Date.parse(a.effectiveTime ?? ''),
        bTime = Date.parse(b.effectiveTime ?? '');
      difference = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    } else {
      const left = field === 'value' ? (a.valueName ?? a.value) : a[field],
        right = field === 'value' ? (b.valueName ?? b.value) : b[field];
      difference =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true });
    }
    return (descending ? -difference : difference) || (a.obsUuid < b.obsUuid ? -1 : a.obsUuid > b.obsUuid ? 1 : 0);
  });
}
