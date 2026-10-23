import { staticPropertySchema, widgetPropertiesSchema, widgetPropertyErrors } from './widget-properties';
import type { DataResult, DataSourceDefinition, ModelDefinition, WidgetInstance } from '../types/caremodels';

export type WidgetManifest = {
  id: string;
  type: WidgetInstance['type'];
  label: string;
  group: 'clinical' | 'actions' | 'layout' | 'advanced';
  version: string;
  description: string;
  propertiesSchema: object;
  minDimensions: { w: number; h: number };
  maxDimensions: { w: number; h: number };
  requiredCapabilities: Array<string>;
  data: boolean;
  resultTypes: Array<DataSourceDefinition['resultType']>;
  dimensions: { w: number; h: number };
  properties: Record<string, unknown>;
  configurable: Array<string>;
  fixture: DataResult;
};
const numeric: DataResult = {
  type: 'demonstration',
  units: 'Demo units',
  values: [
    { obsUuid: 'demo-1', valueType: 'NUMBER', value: 12, effectiveTime: '2026-02-01T12:00:00Z' },
    { obsUuid: 'demo-2', valueType: 'NUMBER', value: 18, effectiveTime: '2026-01-01T12:00:00Z' },
  ],
};
const coded: DataResult = {
  type: 'demonstration',
  values: [
    {
      obsUuid: 'demo-status',
      valueType: 'CODED',
      value: 'demonstration-only',
      valueName: 'Active',
      effectiveTime: '2026-02-01T12:00:00Z',
    },
  ],
};
const scalar = ['NUMBER', 'CODED', 'DATE', 'STRING'] as DataSourceDefinition['resultType'][];
const configurable = [
  'title',
  'subtitle',
  'description',
  'emptyText',
  'unit',
  'decimals',
  'precision',
  'statusMappings',
  'showDate',
  'showStatus',
  'targetMin',
  'targetMax',
];
const manifestDefinitions: Array<
  Omit<
    WidgetManifest,
    'version' | 'description' | 'propertiesSchema' | 'minDimensions' | 'maxDimensions' | 'requiredCapabilities'
  >
> = [
  {
    id: 'metric',
    type: 'metric',
    label: 'Clinical Metric',
    group: 'clinical',
    data: true,
    resultTypes: scalar,
    dimensions: { w: 6, h: 3 },
    properties: {},
    configurable,
    fixture: numeric,
  },
  {
    id: 'clinical-status',
    type: 'metric',
    label: 'Clinical Status',
    group: 'clinical',
    data: true,
    resultTypes: ['CODED', 'STRING'],
    dimensions: { w: 6, h: 3 },
    properties: { presentation: 'status' },
    configurable: ['title', 'subtitle', 'description', 'emptyText'],
    fixture: coded,
  },
  {
    id: 'key-value-metric',
    type: 'metric',
    label: 'Key Value Pair',
    group: 'clinical',
    data: true,
    resultTypes: scalar,
    dimensions: { w: 6, h: 3 },
    properties: { presentation: 'key-value' },
    configurable: ['title', 'subtitle', 'description', 'emptyText', 'unit'],
    fixture: {
      type: 'demonstration',
      values: [
        { obsUuid: 'demo-kv', valueType: 'STRING', value: 'Example value', effectiveTime: '2026-02-01T12:00:00Z' },
      ],
    },
  },
  {
    id: 'date-metric',
    type: 'metric',
    label: 'Date Metric',
    group: 'clinical',
    data: true,
    resultTypes: scalar,
    dimensions: { w: 6, h: 3 },
    properties: { presentation: 'date' },
    configurable: ['title', 'subtitle', 'description', 'emptyText'],
    fixture: {
      type: 'demonstration',
      values: [
        { obsUuid: 'demo-date', valueType: 'DATE', value: '2026-11-15', effectiveTime: '2026-02-01T12:00:00Z' },
      ],
    },
  },
  {
    id: 'trend-chart',
    type: 'trend-chart',
    label: 'Trend Chart',
    group: 'clinical',
    data: true,
    resultTypes: ['TIMESERIES', 'NUMBER'],
    dimensions: { w: 12, h: 6 },
    properties: { chartType: 'line' },
    configurable: ['title', 'subtitle', 'chartType', 'showDataTable', 'unit', 'emptyText', 'viewAllLabel'],
    fixture: numeric,
  },
  {
    id: 'clinical-table',
    type: 'clinical-table',
    label: 'Clinical Table',
    group: 'clinical',
    data: true,
    resultTypes: ['TABLE', ...scalar],
    dimensions: { w: 12, h: 5 },
    properties: {},
    configurable: ['title', 'subtitle', 'emptyText', 'pageSize', 'viewAllLabel'],
    fixture: numeric,
  },
  {
    id: 'timeline',
    type: 'timeline',
    label: 'Encounter Timeline',
    group: 'clinical',
    data: true,
    resultTypes: ['TABLE', ...scalar],
    dimensions: { w: 12, h: 4 },
    properties: {},
    configurable: ['title', 'subtitle', 'emptyText'],
    fixture: {
      type: 'encounter-query',
      records: [
        {
          uuid: 'demo-encounter',
          effectiveTime: '2026-01-01',
          encounterTypeName: 'Example encounter',
          status: 'recorded',
        },
      ],
    },
  },
  {
    id: 'form-launcher',
    type: 'form-launcher',
    label: 'Form Launcher',
    group: 'actions',
    data: false,
    resultTypes: [],
    dimensions: { w: 6, h: 3 },
    properties: {},
    configurable: ['title', 'subtitle', 'formAlias'],
    fixture: numeric,
  },
  {
    id: 'action-panel',
    type: 'action-panel',
    label: 'Quick Actions',
    group: 'actions',
    data: false,
    resultTypes: [],
    dimensions: { w: 12, h: 3 },
    properties: {},
    configurable: ['title', 'subtitle', 'actionIds'],
    fixture: numeric,
  },
  {
    id: 'text-note',
    type: 'text-note',
    label: 'Text / Note',
    group: 'layout',
    data: false,
    resultTypes: [],
    dimensions: { w: 12, h: 2 },
    properties: { text: 'Informational note' },
    configurable: ['text'],
    fixture: numeric,
  },
  {
    id: 'section-heading',
    type: 'section-heading',
    label: 'Section Heading',
    group: 'layout',
    data: false,
    resultTypes: [],
    dimensions: { w: 12, h: 2 },
    properties: { text: 'Section heading', level: 2 },
    configurable: ['text', 'level'],
    fixture: numeric,
  },
  {
    id: 'divider',
    type: 'divider',
    label: 'Divider',
    group: 'layout',
    data: false,
    resultTypes: [],
    dimensions: { w: 12, h: 2 },
    properties: { orientation: 'horizontal' },
    configurable: ['orientation'],
    fixture: numeric,
  },
  {
    id: 'spacer',
    type: 'spacer',
    label: 'Spacer',
    group: 'layout',
    data: false,
    resultTypes: [],
    dimensions: { w: 12, h: 2 },
    properties: { size: 'medium' },
    configurable: ['size'],
    fixture: numeric,
  },
  {
    id: 'static-callout',
    type: 'static-callout',
    label: 'Alert / Callout',
    group: 'layout',
    data: false,
    resultTypes: [],
    dimensions: { w: 12, h: 2 },
    properties: { title: 'Information', text: 'Static guidance', tone: 'info' },
    configurable: ['title', 'text', 'tone'],
    fixture: numeric,
  },
  {
    id: 'condition-list',
    type: 'condition-list',
    label: 'Diagnosis / Conditions',
    group: 'clinical',
    data: true,
    resultTypes: ['TABLE'],
    dimensions: { w: 6, h: 4 },
    properties: {},
    configurable: ['title', 'subtitle', 'description', 'emptyText'],
    fixture: {
      type: 'conditions',
      records: [{ uuid: 'demo', name: 'Example condition', clinicalStatus: 'ACTIVE', onsetDate: '2026-01-01' }],
    },
  },
  {
    id: 'medication-summary',
    type: 'medication-summary',
    label: 'Medication Summary',
    group: 'clinical',
    data: true,
    resultTypes: ['TABLE'],
    dimensions: { w: 6, h: 4 },
    properties: {},
    configurable: ['title', 'subtitle', 'description', 'emptyText'],
    fixture: {
      type: 'order-query',
      records: [
        {
          uuid: 'demo',
          drugName: 'Example medication',
          action: 'NEW',
          activeAtAssessment: true,
          dateActivated: '2026-01-01',
        },
      ],
    },
  },
  {
    id: 'program-summary',
    type: 'program-summary',
    label: 'Program Summary',
    group: 'clinical',
    data: true,
    resultTypes: ['TABLE'],
    dimensions: { w: 6, h: 4 },
    properties: {},
    configurable: ['title', 'subtitle', 'description', 'emptyText'],
    fixture: {
      type: 'program-state',
      records: [{ uuid: 'demo', dateEnrolled: '2026-01-01', dateCompleted: null, currentStates: [] }],
    },
  },
  {
    id: 'patient-summary',
    type: 'patient-summary',
    label: 'Patient Summary',
    group: 'clinical',
    data: true,
    resultTypes: ['TABLE'],
    dimensions: { w: 6, h: 4 },
    properties: {},
    configurable: ['title', 'subtitle', 'description', 'emptyText'],
    fixture: { type: 'patient-summary', fields: { name: 'Example patient', gender: 'F' } },
  },
  {
    id: 'care-plan',
    type: 'care-plan',
    label: 'Care Plan / Milestones',
    group: 'advanced',
    data: false,
    resultTypes: [],
    dimensions: { w: 6, h: 3 },
    properties: {},
    configurable: ['title', 'emptyText'],
    fixture: numeric,
  },
];
export const widgetManifest: Array<WidgetManifest> = manifestDefinitions.map((item) => ({
  ...item,
  properties: {
    ...(item.type === 'metric' ? { showDate: true } : {}),
    ...(item.type === 'trend-chart' ? { scaleType: 'linear', showDataTable: false } : {}),
    ...(item.type === 'clinical-table' ? { pageSize: 5, sortBy: 'effectiveTime', sortOrder: 'desc' } : {}),
    ...item.properties,
  },
  version: '1.0.0',
  description:
    item.group === 'layout'
      ? 'Displays static content without clinical queries.'
      : item.type === 'care-plan'
        ? 'Displays the recorded member pathway stage.'
        : item.data
          ? 'Displays authorized clinical results from compatible registered sources.'
          : 'Displays configured actions; execution depends on resolved backend context.',
  propertiesSchema: staticPropertySchema(item.type) ?? widgetPropertiesSchema,
  minDimensions: { w: 1, h: 1 },
  maxDimensions: { w: 12, h: 20 },
  requiredCapabilities:
    item.group === 'layout'
      ? []
      : item.type === 'care-plan'
        ? ['recorded-pathway-descriptor']
        : item.type === 'condition-list'
          ? ['conditions']
          : item.type === 'program-summary'
            ? ['program-state']
            : item.type === 'medication-summary'
              ? ['order-query']
              : item.type === 'patient-summary'
                ? ['patient-summary']
                : item.type === 'timeline'
                  ? ['encounter-query']
                  : item.data
                    ? ['latest-observation']
                    : ['resolved-action-context'],
}));
export const unavailableWidgets = [
  { label: 'Care Reminders', group: 'clinical' },
  { label: 'Order / Request Actions', group: 'actions' },
  { label: 'Appointment Actions', group: 'actions' },
  { label: 'Patient List Link', group: 'actions' },
  { label: 'Summary Chart', group: 'advanced' },
  { label: 'Adherence Indicator', group: 'advanced' },
  { label: 'Risk Indicator', group: 'advanced' },
  { label: 'Custom Metric (Derived)', group: 'advanced' },
];
export function manifestFor(widget: WidgetInstance) {
  // Metric presentations share one clinical component; each profile is its own palette entry.
  const metricProfile =
    widget.type === 'metric'
      ? ({
          status: 'clinical-status',
          'key-value': 'key-value-metric',
          date: 'date-metric',
        }[String(widget.properties?.presentation)] ?? 'metric')
      : widget.type;
  return widgetManifest.find((item) => item.id === metricProfile);
}
export function fieldsForSource(source?: DataSourceDefinition): Array<string> {
  const id = source?.type === 'registered' ? source.resolverId : source?.type;
  const fields: Record<string, Array<string>> = {
    'encounter-query': ['uuid', 'effectiveTime', 'encounterTypeUuid', 'encounterTypeName', 'status'],
    conditions: ['uuid', 'onsetDate', 'endDate', 'clinicalStatus', 'verificationStatus', 'conceptUuid', 'name'],
    'encounter-diagnoses': ['uuid', 'encounterUuid', 'effectiveTime', 'certainty', 'conceptUuid', 'name'],
    'program-state': ['uuid', 'dateEnrolled', 'dateCompleted'],
    'order-query': [
      'uuid',
      'action',
      'dateActivated',
      'effectiveStartDate',
      'effectiveStopDate',
      'autoExpireDate',
      'activeAtAssessment',
      'previousOrderUuid',
      'orderTypeUuid',
      'drugUuid',
      'drugName',
      'dose',
      'doseUnitsConceptUuid',
    ],
  };
  return fields[id ?? ''] ?? ['value', 'effectiveTime', 'valueType', 'obsUuid'];
}
export function sourceCompatibility(widget: WidgetInstance, source?: DataSourceDefinition): string | null {
  const manifest = manifestFor(widget);
  if (!manifest?.data) return null;
  if (!source) return 'Select a declared data source.';
  const id = source.type === 'registered' ? source.resolverId : source.type;
  const required: Record<string, Array<string>> = {
    'condition-list': ['conditions', 'encounter-diagnoses'],
    'medication-summary': ['order-query'],
    'program-summary': ['program-state'],
    'patient-summary': ['patient-summary'],
  };
  if (required[widget.type])
    return source.resultType === 'TABLE' && required[widget.type].includes(id ?? '')
      ? null
      : 'Select a compatible typed record source.';
  if (
    widget.type === 'clinical-table' &&
    source.resultType === 'TABLE' &&
    ['encounter-query', 'program-state', 'order-query', 'conditions', 'encounter-diagnoses'].includes(id ?? '')
  )
    return null;
  if (widget.type === 'timeline' && id === 'encounter-query' && source.resultType === 'TABLE') return null;
  if (!['latest-observation', 'historical-observations'].includes(source.type))
    return 'This backend has no registered implementation for this source type.';
  if (!manifest.resultTypes.includes(source.resultType))
    return `This widget does not accept ${source.resultType} results.`;
  if (widget.type === 'trend-chart' && (source.maxResults ?? 1) < 2)
    return 'Select a source configured for multiple recent observations.';
  if (widget.type === 'trend-chart' && !['NUMBER', 'TIMESERIES'].includes(source.resultType))
    return 'The registered observation resolver must return numeric observations for a chart.';
  return null;
}

/** Drafts may be incomplete; validate/publish must reject incompatible bindings. */
export function widgetBindingErrors(definition: ModelDefinition): Array<string> {
  return definition.workspace.tabs.flatMap((tab, tabIndex) =>
    tab.widgets.flatMap((widget, widgetIndex) => {
      const bindings =
        widget.type === 'trend-chart' && widget.dataSources?.length ? widget.dataSources : [widget.dataSource ?? ''];
      const error = bindings.map((key) => sourceCompatibility(widget, definition.dataSources[key])).find(Boolean);
      const sources = bindings.map((key) => definition.dataSources[key]);
      const incompatibleUnits =
        bindings.length > 1 &&
        (sources.some((source) => !source?.units) || new Set(sources.map((source) => source?.units)).size > 1);

      const path = `$.workspace.tabs[${tabIndex}].widgets[${widgetIndex}]`;
      const columns = widget.properties?.columns as Array<{ field: string }> | undefined;
      const invalidColumns =
        widget.type === 'clinical-table' &&
        columns?.some(({ field }) => !fieldsForSource(definition.dataSources[widget.dataSource ?? '']).includes(field));
      return [
        ...(incompatibleUnits ? [`${path}.dataSources: select sources with matching explicit units`] : []),
        ...(widget.dataSource && widget.dataSources ? [`${path}: use dataSource or dataSources, not both`] : []),
        ...(invalidColumns ? [`${path}.properties.columns: select fields declared by the resolver`] : []),
        ...(error ? [`${path}.dataSource: ${error}`] : []),
        ...widgetPropertyErrors(widget).map((message) => `${path}.properties: ${message}`),
      ];
    }),
  );
}

export function bindWidgetSource(widget: WidgetInstance, key: string, source?: DataSourceDefinition): WidgetInstance {
  const properties = { ...widget.properties };
  const observation = ['latest-observation', 'historical-observations'].includes(source?.type ?? '');
  if (observation) properties.unit = source?.units ?? '';
  else delete properties.unit;
  if (widget.type === 'clinical-table' && source?.resultType === 'TABLE') {
    delete properties.sortBy;
    delete properties.columns;
  }
  const columns = properties.columns as Array<{ field: string; label: string }> | undefined;
  if (columns?.some(({ field }) => !fieldsForSource(source).includes(field))) delete properties.columns;
  const updated = { ...widget, dataSource: key || undefined, properties };
  delete updated.dataSources;
  return updated;
}
