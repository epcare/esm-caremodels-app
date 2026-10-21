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
    (result.units != null && typeof result.units !== 'string') ||
    (result.concept != null && typeof result.concept !== 'string') ||
    (result.values !== undefined &&
      (!Array.isArray(result.values) ||
        result.values.some(
          (value) =>
            !isRecord(value) ||
            typeof value.obsUuid !== 'string' ||
            'qualifier' in value ||
            'comparator' in value ||
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
  const typed = [
    'encounter-query',
    'program-state',
    'order-query',
    'conditions',
    'encounter-diagnoses',
    'patient-summary',
  ];
  if (typed.includes(result.type)) {
    if (result.type === 'patient-summary') {
      const allowed = ['name', 'gender', 'birthdate', 'birthdateEstimated', 'dead', 'deathDate'];
      if (
        !isRecord(result.fields) ||
        Object.entries(result.fields).some(
          ([key, value]) =>
            !allowed.includes(key) || (value !== null && typeof value !== 'string' && typeof value !== 'boolean'),
        )
      )
        throw new Error('Invalid patient summary result');
    } else if (
      !Array.isArray(result.records) ||
      result.records.length > 1000 ||
      result.records.some((record) => !isRecord(record) || typeof record.uuid !== 'string')
    )
      throw new Error('Invalid clinical records result');
    if (Array.isArray(result.records)) {
      const textFields = [
        'name',
        'clinicalStatus',
        'certainty',
        'onsetDate',
        'endDate',
        'effectiveTime',
        'drugName',
        'action',
        'dateActivated',
        'effectiveStopDate',
        'dateEnrolled',
        'dateCompleted',
        'encounterTypeName',
        'status',
      ];
      for (const record of result.records) {
        if (textFields.some((key) => record[key] != null && typeof record[key] !== 'string'))
          throw new Error('Invalid clinical record field');
        if (record.activeAtAssessment != null && typeof record.activeAtAssessment !== 'boolean')
          throw new Error('Invalid order status');
        if (
          record.currentStates !== undefined &&
          (!Array.isArray(record.currentStates) ||
            record.currentStates.some(
              (state: unknown) =>
                !isRecord(state) || ['uuid', 'stateUuid', 'startDate'].some((key) => typeof state[key] !== 'string'),
            ))
        )
          throw new Error('Invalid program states');
      }
      if (
        result.availableFields !== undefined &&
        (!Array.isArray(result.availableFields) || result.availableFields.some((field) => typeof field !== 'string'))
      )
        throw new Error('Invalid record fields');
    }
    if (result.truncated !== undefined && typeof result.truncated !== 'boolean')
      throw new Error('Invalid clinical result bounds');
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
    ['formAliases', 'dataSources'].every(
      (key) =>
        value[key] === undefined || (Array.isArray(value[key]) && value[key].every((item) => typeof item === 'string')),
    ) &&
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
  if (value.descriptors !== undefined) {
    const descriptors = value.descriptors;
    if (
      !isRecord(descriptors) ||
      descriptors.version !== '1.0.0' ||
      ['forms', 'actions'].some(
        (key) =>
          !Array.isArray(descriptors[key]) ||
          descriptors[key].some(
            (item: unknown) =>
              !isRecord(item) ||
              typeof item[key === 'forms' ? 'alias' : 'id'] !== 'string' ||
              typeof item.available !== 'boolean' ||
              ['reason', 'name', 'label', 'type', 'formUuid'].some(
                (field) => item[field] != null && typeof item[field] !== 'string',
              ),
          ),
      )
    )
      throw new Error('Invalid workspace descriptors');
    const pathway = descriptors.pathway;
    if (
      pathway !== undefined &&
      (!isRecord(pathway) ||
        typeof pathway.status !== 'string' ||
        ['stage', 'label', 'enteredAt'].some((key) => pathway[key] != null && typeof pathway[key] !== 'string'))
    )
      throw new Error('Invalid member pathway');
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
