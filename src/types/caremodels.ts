/**
 * TypeScript mirror of the backend care model contract (openmrs-module-caremodels, schema
 * version 1.0.0). Only the shapes the frontend consumes; the authoritative definitions are the
 * JSON Schemas bundled in the module (api/src/main/resources/schemas/).
 */

/** Authorized ACTIVE membership, as returned by GET /ws/rest/v1/caremodels/membership?patient= */
export interface CareModelMembership {
  memberUuid: string;
  modelUuid: string;
  modelCode: string;
  modelName: string;
  displayLabel: string;
  /** Optional API ordering metadata; older backend builds preserve their returned list order. */
  displayOrder?: number;
  episodeNumber: number;
  dateEnrolled?: string;
}

/** Widget instance as authored in the published definition's tab. */
export interface WidgetInstance {
  id: string;
  type:
    | 'metric'
    | 'trend-chart'
    | 'clinical-table'
    | 'timeline'
    | 'form-launcher'
    | 'action-panel'
    | 'text-note'
    | 'section-heading'
    | 'divider'
    | 'spacer'
    | 'static-callout'
    | 'condition-list'
    | 'medication-summary'
    | 'program-summary'
    | 'patient-summary'
    | 'care-plan';
  componentVersion?: string;
  dataSource?: string;
  actionIds?: Array<string>;
  formAliases?: Array<string>;
  dataSources?: Array<string>;
  formAlias?: string;
  loadingPolicy?: 'ON_VISIBLE' | 'EAGER';
  position?: { row: number; col: number; w: number; h: number };
  properties?: Record<string, unknown>;
}

/** Tab summary (id + label) from the workspace response's tab list. */
export interface TabSummary {
  id: string;
  label: string;
}

export interface WorkspaceDescriptors {
  version: string;
  forms: Array<{ alias: string; available: boolean; reason?: string; formUuid?: string; name?: string; encounterTypeUuid?: string; version?: string }>;
  actions: Array<{ id: string; available: boolean; reason?: string; label?: string; type?: string }>;
  pathway?: { status: string; stage?: string; label?: string; enteredAt?: string };
}

/** Inner tab slice served by GET /ws/rest/v1/caremodels/workspace?patient=&model=&tab= */
export interface WorkspaceTab {
  modelCode: string;
  modelUuid: string;
  memberUuid: string;
  tabId: string;
  tabLabel: string;
  descriptors?: WorkspaceDescriptors;
  widgets: Array<WidgetInstance>;
  layouts?: WorkspaceLayouts;
  /** All tabs of the definition; present so the inner-tab strip needs no extra request. */
  tabs?: Array<TabSummary>;
}

/** Resolver output (resultJson field of POST /ws/rest/v1/caremodels/data). */
export interface DataResult {
  type: string;
  records?: Array<Record<string, unknown> & { uuid: string }>;
  fields?: Record<string, string | boolean | null>;
  availableFields?: Array<string>;
  truncated?: boolean;
  status?: string;
  scope?: string;
  assessedAt?: string;
  units?: string;
  concept?: string;
  values?: Array<{
    obsUuid: string;
    effectiveTime?: string;
    valueType: 'NUMBER' | 'CODED' | 'STRING' | 'DATE';
    value?: number | string;
    valueName?: string;
  }>;
}

/** Current-session slice used for the master-privilege gate. */
export interface CareModelsSession {
  authenticated: boolean;
  user?: {
    uuid: string;
    display: string;
    privileges: Array<{ name: string }>;
  };
}

/** Registry listing entry (safe metadata; never carries the configuration envelope). */
export interface RegistryModel {
  uuid: string;
  code: string;
  name: string;
  description?: string;
  privilege: string;
  status: 'DRAFT' | 'PUBLISHED' | 'INACTIVE' | 'RETIRED';
  revision: number;
  retired: boolean;
}

export interface GridPosition {
  row: number;
  col: number;
  w: number;
  h: number;
}
export interface LayoutItem extends GridPosition {
  widgetId: string;
}
export interface WorkspaceLayouts {
  wide?: Array<LayoutItem>;
  narrow?: Array<LayoutItem>;
}
export interface DefinitionTab {
  id: string;
  label: string;
  widgets: Array<WidgetInstance>;
  layouts?: WorkspaceLayouts;
  visibilityRule?: RuleNode;
}
export interface DataSourceDefinition {
  type:
    | 'latest-observation'
    | 'historical-observations'
    | 'program-state'
    | 'encounter-query'
    | 'order-query'
    | 'registered';
  fields?: Array<'name' | 'gender' | 'birthdate' | 'birthdateEstimated' | 'dead' | 'deathDate'>;
  conceptAlias?: string;
  programAlias?: string;
  encounterTypeAlias?: string;
  formAlias?: string;
  windowDays?: number;
  maxResults?: number;
  units?: string;
  includeVoided?: false;
  resolverId?: string;
  resolverVersion?: string;
  resultType: 'NUMBER' | 'CODED' | 'DATE' | 'STRING' | 'TIMESERIES' | 'TABLE';
  effectiveTime?: 'OBS_DATETIME' | 'ENCOUNTER_DATETIME' | 'NOW';
}
export interface FormReference {
  alias: string;
  formUuid: string;
  encounterTypeAlias?: string;
  required?: boolean;
}
export interface ActionDefinition {
  id: string;
  type: 'launch-form' | 'navigate-internal' | 'open-order-entry' | 'open-appointments' | 'enrollment-transition';
  label: string;
  formAlias?: string;
  target?: string;
  transition?: 'SUSPEND' | 'COMPLETE' | 'WITHDRAW';
  requiresReason?: boolean;
  availabilityRule?: RuleNode;
}
export interface ModelDefinition {
  schemaVersion: '1.0.0';
  metadata: {
    category: 'CHRONIC_CARE' | 'MATERNAL' | 'PREVENTIVE' | 'SUPPORT';
    display: { label: string; order?: number };
  };
  terminology: Partial<
    Record<'concepts' | 'programs' | 'encounterTypes' | 'forms' | 'codedAnswers', Record<string, string>>
  >;
  enrollment: {
    enabled: boolean;
    triggers?: Array<{
      type: string;
      alias?: string;
      conceptAlias?: string;
      programAlias?: string;
      encounterTypeAlias?: string;
    }>;
    rules?: Array<{ id: string; action: 'EXCLUDE' | 'AUTO_ENROLL' | 'PROPOSE_CONFIRMATION'; expression: RuleNode }>;
    manualEnrollment?: { enabled?: boolean; requiresReason?: boolean };
    reenrollment?: { enabled?: boolean; cooldownDays?: number };
  };
  dataSources: Record<string, DataSourceDefinition>;
  workspace: { defaultTab?: string; tabs: Array<DefinitionTab> };
  forms: Array<FormReference>;
  actions: Array<ActionDefinition>;
  pathways?: {
    enabled: boolean;
    stages?: Array<{ id: string; label: string }>;
    transitions?: Array<{ from: string; to: string; expression?: RuleNode }>;
  };
  automation?: {
    rules: Array<{
      id: string;
      operation: 'INVALIDATE_DATA' | 'PROPOSE_ENROLLMENT' | 'FLAG_FOR_REVIEW';
      expression: RuleNode;
    }>;
  };
  lifecycle: {
    completion: { mode: 'MANUAL' | 'RULE'; ruleId?: string };
    onSourceCorrection: 'FLAG_FOR_REVIEW' | 'AUTO_TRANSITION';
  };
}
export interface StorageEnvelope {
  storageSchemaVersion: '1.0.0';
  revision: number;
  draft?: { basedOnVersion: string; definition: ModelDefinition };
  published?: { version: string; checksum: string; publishedAt: string; definition: ModelDefinition };
  history?: Array<{ version: string; checksum: string; publishedAt: string; definition: ModelDefinition }>;
}

export type RuleNode = RuleGroup | RulePredicate | { literal: 'TRUE' | 'FALSE' };
export interface RuleGroup {
  all?: Array<RuleNode>;
  any?: Array<RuleNode>;
  not?: RuleNode;
}
export interface RulePredicate {
  type: 'program' | 'encounter' | 'observation' | 'enrollment';
  operator: string;
  alias?: string;
  value?: string | number | boolean;
  windowDays?: number;
  unit?: string;
  codedAnswerAlias?: string;
}
