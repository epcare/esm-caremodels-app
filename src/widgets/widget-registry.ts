import type { DataResult, DataSourceDefinition, ModelDefinition, WidgetInstance } from '../types/caremodels';

export type WidgetManifest = {
  id: string;
  type: WidgetInstance['type'];
  label: string;
  group: 'clinical' | 'actions' | 'layout';
  data: boolean;
  resultTypes: Array<DataSourceDefinition['resultType']>;
  dimensions: { w: number; h: number };
  properties: Record<string, unknown>;
  configurable: Array<string>;
  fixture: DataResult;
};
const numeric: DataResult = {
  type: 'demonstration',
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
  'showStatus',
  'targetMin',
  'targetMax',
];
export const widgetManifest: Array<WidgetManifest> = [
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
    id: 'trend-chart',
    type: 'trend-chart',
    label: 'Trend Chart',
    group: 'clinical',
    data: true,
    resultTypes: ['TIMESERIES', 'NUMBER'],
    dimensions: { w: 12, h: 6 },
    properties: { chartType: 'line' },
    configurable: ['title', 'subtitle', 'chartType', 'showDataTable', 'unit', 'emptyText'],
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
    configurable: ['title', 'subtitle', 'emptyText', 'pageSize'],
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
    fixture: numeric,
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
];
export const unavailableWidgets = [
  { label: 'Diagnosis / Conditions', group: 'clinical' },
  { label: 'Medication Summary', group: 'clinical' },
  { label: 'Program Summary', group: 'clinical' },
  { label: 'Patient Summary', group: 'clinical' },
  { label: 'Care Reminders', group: 'actions' },
  { label: 'Care Plan Summary', group: 'actions' },
  { label: 'Text / Note', group: 'layout' },
  { label: 'Section Heading', group: 'layout' },
];
export function manifestFor(widget: WidgetInstance) {
  return widgetManifest.find(
    (item) =>
      item.id ===
      (widget.type === 'metric' && widget.properties?.presentation === 'status' ? 'clinical-status' : widget.type),
  );
}
export function sourceCompatibility(widget: WidgetInstance, source?: DataSourceDefinition): string | null {
  const manifest = manifestFor(widget);
  if (!manifest?.data) return null;
  if (!source) return 'Select a declared data source.';
  if (source.type !== 'latest-observation')
    return 'This backend has no registered implementation for this source type.';
  if (!manifest.resultTypes.includes(source.resultType))
    return `This widget does not accept ${source.resultType} results.`;
  if (['trend-chart', 'clinical-table', 'timeline'].includes(widget.type) && (source.maxResults ?? 1) < 2)
    return 'Select a source configured for multiple recent observations.';
  if (widget.type === 'trend-chart' && !['NUMBER', 'TIMESERIES'].includes(source.resultType))
    return 'The registered observation resolver must return numeric observations for a chart.';
  return null;
}

/** Drafts may be incomplete; validate/publish must reject incompatible bindings. */
export function widgetBindingErrors(definition: ModelDefinition): Array<string> {
  return definition.workspace.tabs.flatMap((tab, tabIndex) =>
    tab.widgets.flatMap((widget, widgetIndex) => {
      const error = sourceCompatibility(widget, definition.dataSources[widget.dataSource ?? '']);
      return error ? [`$.workspace.tabs[${tabIndex}].widgets[${widgetIndex}].dataSource: ${error}`] : [];
    }),
  );
}

export function bindWidgetSource(widget: WidgetInstance, key: string, source?: DataSourceDefinition): WidgetInstance {
  return { ...widget, dataSource: key || undefined, properties: { ...widget.properties, unit: source?.units ?? '' } };
}
