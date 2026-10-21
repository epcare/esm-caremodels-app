import type { DataResult, StorageEnvelope, WorkspaceTab } from '../types/caremodels';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Fail closed on malformed clinical results rather than rendering unchecked JSON. */
export function parseDataResult(json: unknown): DataResult {
  if (typeof json !== 'string') throw new Error('Care Models data response is missing resultJson');
  const result: unknown = JSON.parse(json);
  if (
    !isRecord(result) ||
    typeof result.type !== 'string' ||
    (result.concept != null && typeof result.concept !== 'string') ||
    (result.values !== undefined &&
      (!Array.isArray(result.values) ||
        result.values.some(
          (value) =>
            !isRecord(value) ||
            typeof value.obsUuid !== 'string' ||
            !['NUMBER', 'CODED', 'STRING', 'DATE'].includes(String(value.valueType)) ||
            (value.effectiveTime != null && typeof value.effectiveTime !== 'string') ||
            (value.valueName != null && typeof value.valueName !== 'string') ||
            (value.value != null &&
              (value.valueType === 'NUMBER'
                ? typeof value.value !== 'number' || !Number.isFinite(value.value)
                : typeof value.value !== 'string')),
        )))
  ) {
    throw new Error('Invalid Care Models clinical result');
  }
  return result as unknown as DataResult;
}

export function parseEnvelope(json: unknown): StorageEnvelope {
  if (typeof json !== 'string') throw new Error('Missing Care Models envelope');
  const envelope: unknown = JSON.parse(json);
  if (
    !isRecord(envelope) ||
    envelope.storageSchemaVersion !== '1.0.0' ||
    !Number.isInteger(envelope.revision) ||
    Number(envelope.revision) < 0
  )
    throw new Error('Invalid Care Models envelope');
  const snapshot = envelope.draft ?? envelope.published;
  if (
    !isRecord(snapshot) ||
    !isRecord(snapshot.definition) ||
    snapshot.definition.schemaVersion !== '1.0.0' ||
    !isRecord(snapshot.definition.workspace) ||
    !Array.isArray(snapshot.definition.workspace.tabs) ||
    !snapshot.definition.workspace.tabs.length
  )
    throw new Error('The model has no editable definition');
  return envelope as unknown as StorageEnvelope;
}

function validPosition(value: unknown): boolean {
  return (
    isRecord(value) &&
    [
      ['row', 0, 100],
      ['col', 1, 12],
      ['w', 1, 12],
      ['h', 1, 20],
    ].every(
      ([key, min, max]) =>
        Number.isInteger(value[String(key)]) &&
        Number(value[String(key)]) >= Number(min) &&
        Number(value[String(key)]) <= Number(max),
    ) &&
    Number(value.col) + Number(value.w) <= 13
  );
}
function validWidget(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    (value.dataSource === undefined || typeof value.dataSource === 'string') &&
    (value.formAlias === undefined || typeof value.formAlias === 'string') &&
    (value.actionIds === undefined ||
      (Array.isArray(value.actionIds) && value.actionIds.every((id) => typeof id === 'string'))) &&
    (value.position === undefined || validPosition(value.position)) &&
    (value.properties === undefined ||
      (isRecord(value.properties) &&
        (value.properties.title === undefined || typeof value.properties.title === 'string')))
  );
}
function validLayouts(value: unknown) {
  return (
    value === undefined ||
    (isRecord(value) &&
      ['wide', 'narrow'].every(
        (size) =>
          value[size] === undefined ||
          (Array.isArray(value[size]) &&
            value[size].every((item) => validPosition(item) && isRecord(item) && typeof item.widgetId === 'string')),
      ))
  );
}

export function parseWorkspace(value: unknown): WorkspaceTab {
  if (
    !isRecord(value) ||
    ['modelCode', 'modelUuid', 'memberUuid', 'tabId', 'tabLabel'].some((key) => typeof value[key] !== 'string') ||
    !Array.isArray(value.widgets) ||
    value.widgets.some((widget) => !validWidget(widget)) ||
    !validLayouts(value.layouts) ||
    (value.tabs !== undefined &&
      (!Array.isArray(value.tabs) ||
        value.tabs.some((tab) => !isRecord(tab) || typeof tab.id !== 'string' || typeof tab.label !== 'string')))
  ) {
    throw new Error('Invalid Care Models workspace configuration');
  }
  return value as unknown as WorkspaceTab;
}

export function isAuthorizationError(error: unknown) {
  if (!isRecord(error)) return false;
  const status = error.status ?? (isRecord(error.response) ? error.response.status : undefined);
  return status === 401 || status === 403;
}

export const patientRequestOptions = {
  keepPreviousData: false,
  shouldRetryOnError: false,
  revalidateOnFocus: true,
};

export interface RestCollection<T> {
  results: Array<T>;
  links?: Array<{ rel: string; uri: string }>;
}

/** RESTWS uses uri, not href, in next links. Only carry its cursor onto our own endpoint. */
export function nextRestPage<T>(collection: RestCollection<T>, currentIndex: number): number | null {
  const next = collection.links?.find((link) => link.rel === 'next');
  if (!next) return null;
  const cursor = new URL(next.uri, window.location.origin).searchParams.get('startIndex');
  const index = cursor === null ? NaN : Number(cursor);
  if (!Number.isSafeInteger(index) || index <= currentIndex)
    throw new Error('The REST endpoint returned an invalid next page.');
  return index;
}
