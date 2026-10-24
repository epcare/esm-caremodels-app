import Ajv from 'ajv';
import modelSchema from '../admin/designer/schemas/model-definition.schema.json';
import type { WidgetInstance } from '../types/caremodels';

export const observationFields = ['value', 'effectiveTime', 'valueType', 'obsUuid'] as const;
export type ObservationField = (typeof observationFields)[number];
export const recordFields = [
  'uuid',
  'effectiveTime',
  'encounterTypeUuid',
  'encounterTypeName',
  'status',
  'name',
  'conceptUuid',
  'onsetDate',
  'endDate',
  'clinicalStatus',
  'verificationStatus',
  'certainty',
  'encounterUuid',
  'drugName',
  'drugUuid',
  'action',
  'dateActivated',
  'effectiveStartDate',
  'effectiveStopDate',
  'autoExpireDate',
  'activeAtAssessment',
  'previousOrderUuid',
  'orderTypeUuid',
  'dose',
  'doseUnitsConceptUuid',
  'dateEnrolled',
  'dateCompleted',
  'currentStates',
] as const;
export const tagTones = ['blue', 'gray', 'green', 'red', 'teal', 'purple', 'warm-gray'] as const;
export interface StatusMapping {
  value: string;
  label: string;
  tone: (typeof tagTones)[number];
}
const text = { type: 'string', maxLength: 1000 };
export const widgetPropertiesSchema = {
  type: 'object',
  maxProperties: 30,
  additionalProperties: false,
  properties: {
    title: text,
    subtitle: text,
    description: { type: 'string', maxLength: 4000 },
    emptyText: text,
    emptyMessage: text,
    unit: { type: 'string', maxLength: 20 },
    decimals: { type: 'integer', minimum: 0, maximum: 4 },
    precision: { type: 'integer', minimum: 0, maximum: 4 },
    showDate: { type: 'boolean' },
    showStatus: { type: 'boolean' },
    targetMin: { type: 'number' },
    targetMax: { type: 'number' },
    presentation: { enum: ['value', 'status', 'date', 'key-value'] },
    viewAllLabel: text,
    chartType: { enum: ['line', 'bar'] },
    showDataTable: { type: 'boolean' },
    scaleType: { enum: ['linear', 'log'] },
    pageSize: { type: 'integer', minimum: 5, maximum: 50 },
    sortBy: { enum: observationFields },
    sortOrder: { enum: ['asc', 'desc'] },
    columns: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      uniqueItems: true,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'label'],
        properties: {
          field: { enum: observationFields },
          label: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
    statusMappings: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'label', 'tone'],
        properties: {
          value: { type: 'string', minLength: 1, maxLength: 100 },
          label: { type: 'string', minLength: 1, maxLength: 100 },
          tone: { enum: tagTones },
        },
      },
    },
    actionLabels: { type: 'object', maxProperties: 50, additionalProperties: { type: 'string', maxLength: 100 } },
    orientation: { enum: ['horizontal', 'vertical'] },
    buttonStyle: { enum: ['primary', 'secondary', 'tertiary', 'ghost'] },
    buttonLabel: text,
    // grouped observation-set widgets (latest-set-results, set-history-trends)
    density: { enum: ['compact', 'regular'] },
    showUnits: { type: 'boolean' },
    showReferenceRange: { type: 'boolean' },
    showMissing: { type: 'boolean' },
    maxVisible: { type: 'integer', minimum: 1, maximum: 50 },
    members: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      uniqueItems: true,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['conceptUuid', 'label', 'inTable'],
        properties: {
          conceptUuid: { type: 'string', minLength: 1, maxLength: 100 },
          label: { type: 'string', minLength: 1, maxLength: 100 },
          inTable: { type: 'boolean' },
          inChart: { type: 'boolean' },
        },
      },
    },
    defaultView: { enum: ['chart', 'table'] },
    rowsPerPage: { type: 'integer', minimum: 5, maximum: 50 },
    defaultRange: { enum: ['6m', '1y', '2y', '5y', 'all'] },
    chartLayout: { enum: ['combined', 'panels'] },
  },
};
const staticTypes = ['text-note', 'section-heading', 'divider', 'spacer', 'static-callout'];
export function isStaticWidget(widget: WidgetInstance) {
  return staticTypes.includes(widget.type);
}
const staticSchemas: Record<string, object> = Object.fromEntries(
  modelSchema.properties.workspace.properties.tabs.items.properties.widgets.items.allOf.map((rule) => [
    rule.if.properties.type.const,
    rule.then.properties.properties,
  ]),
);
export function staticPropertySchema(type: string): object | undefined {
  return staticSchemas[type];
}
const staticValidators = Object.fromEntries(
  Object.entries(staticSchemas).map(([key, schema]) => [
    key,
    new Ajv({ allErrors: true, strict: false }).compile(schema),
  ]),
);
const validate = new Ajv({ allErrors: true, strict: false }).compile(widgetPropertiesSchema);
export function widgetPropertyErrors(widget: WidgetInstance): Array<string> {
  if (widget.componentVersion && widget.componentVersion !== '1.0.0') return ['Unsupported widget component version'];
  const validator = staticValidators[widget.type] ?? validate;
  if (
    isStaticWidget(widget) &&
    (widget.dataSource || widget.dataSources || widget.actionIds || widget.formAlias || widget.formAliases)
  )
    return ['Static widgets cannot bind clinical data, forms or actions'];
  if (!validator(widget.properties ?? {}))
    return (validator.errors ?? []).map((error) => `${error.instancePath || '/'}: ${error.message}`);
  const properties = widget.properties ?? {};
  const mappings = (properties.statusMappings ?? []) as Array<StatusMapping>;
  if (new Set(mappings.map((mapping) => mapping.value)).size !== mappings.length)
    return ['statusMappings: each value must have one mapping'];
  if (
    typeof properties.targetMin === 'number' &&
    typeof properties.targetMax === 'number' &&
    properties.targetMin > properties.targetMax
  )
    return ['targetMin must not exceed targetMax'];
  const columns = properties.columns as Array<{ field: string }> | undefined;
  if (columns && new Set(columns.map((column) => column.field)).size !== columns.length)
    return ['columns: each field must appear once'];
  return [];
}
