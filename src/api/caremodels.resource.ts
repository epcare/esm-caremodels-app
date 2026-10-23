import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR, { useSWRConfig } from 'swr';
import {
  isAuthorizationError,
  nextRestPage,
  parseDataResult,
  parseWorkspace,
  patientRequestOptions,
  type RestCollection,
} from './contract';
import { careModelsBaseUrl, masterPrivilege } from '../constants';
import type {
  CareModelMembership,
  CareModelsSession,
  DataResult,
  RegistryModel,
  WorkspaceTab,
} from '../types/caremodels';

/**
 * Care Models REST client. Every endpoint here is independently authorized server-side; the
 * client-side checks exist only to decide what NOT to request.
 */

export async function fetchSession(): Promise<CareModelsSession> {
  const { data } = await openmrsFetch<CareModelsSession>(`${restBaseUrl}/session`);
  return data;
}

/** Master-privilege gate: no Care Models requests are made when this returns false. */
export function hasMasterPrivilege(session: CareModelsSession | undefined): boolean {
  return Boolean(
    session?.authenticated && session?.user?.privileges?.some((privilege) => privilege.name === masterPrivilege),
  );
}

export async function fetchMemberships(patientUuid: string): Promise<Array<CareModelMembership>> {
  const memberships = new Map<string, CareModelMembership>();
  let startIndex = 0;
  for (;;) {
    const { data } = await openmrsFetch<RestCollection<CareModelMembership>>(
      `${careModelsBaseUrl}/membership?patient=${encodeURIComponent(patientUuid)}&v=default${startIndex ? `&startIndex=${startIndex}` : ''}`,
    );
    for (const membership of data.results ?? [])
      memberships.set(membership.memberUuid ?? membership.modelCode, membership);
    const next = nextRestPage(data, startIndex);
    if (next === null) return Array.from(memberships.values());
    startIndex = next;
  }
}

export async function fetchWorkspaceTab(
  patientUuid: string,
  modelCode: string,
  tabId: string | null,
): Promise<WorkspaceTab> {
  const tabQuery = tabId ? `&tab=${encodeURIComponent(tabId)}` : '';
  const { data } = await openmrsFetch<{ results?: Array<WorkspaceTab> } | Array<WorkspaceTab>>(
    `${careModelsBaseUrl}/workspace?patient=${encodeURIComponent(patientUuid)}&model=${encodeURIComponent(modelCode)}${tabQuery}&v=default`,
  );
  // the endpoint returns a single-element result set
  const tab = Array.isArray(data) ? data[0] : data.results?.[0];
  if (!tab) {
    throw new Error('Workspace tab not found');
  }
  return parseWorkspace(tab);
}

export async function fetchWidgetData(
  patientUuid: string,
  modelCode: string,
  tabId: string,
  dataSource: string,
): Promise<DataResult> {
  const { data } = await openmrsFetch<{ resultJson: string }>(`${careModelsBaseUrl}/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient: patientUuid, model: modelCode, tab: tabId, dataSource }),
  });
  return parseDataResult(data.resultJson);
}

export function useSession() {
  return useSWR<CareModelsSession>('caremodels-session', fetchSession, {
    refreshInterval: 60000,
    shouldRetryOnError: false,
  });
}

export function useMemberships(patientUuid: string | null, enabled: boolean) {
  return useSWR<Array<CareModelMembership>>(
    enabled && patientUuid ? ['caremodels-memberships', patientUuid] : null,
    ([, uuid]) => fetchMemberships(uuid as string),
    patientRequestOptions,
  );
}

/** Admin registry listing; requires the manage privilege server-side. */
export async function fetchRegistryModels(q: string, status?: RegistryModel['status']): Promise<Array<RegistryModel>> {
  const load = async (search: boolean): Promise<Array<RegistryModel>> => {
    // Cumulative prefixes also tolerate older deployments that paginated twice.
    let limit = 100;
    let previousLength = -1;
    for (;;) {
      const params = search
        ? `includeRetired=true${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`
        : 'includeAll=true';
      const { data } = await openmrsFetch<{ results: Array<RegistryModel>; links?: Array<{ rel: string }> }>(
        `${careModelsBaseUrl}/model?${params}&v=default&startIndex=0&limit=${limit}`,
        { cache: 'no-store' },
      );
      if (!data || !Array.isArray(data.results))
        throw new Error('Invalid Care Models registry response: expected a REST results collection.');
      const results = data.results;
      if (results.length < limit && !data.links?.some((link) => link.rel === 'next')) return results;
      if (results.length <= previousLength || limit >= 10000)
        throw new Error('The server registry page limit was reached. Narrow the registry search.');
      previousLength = results.length;
      limit *= 2;
    }
  };
  const searched = await load(true);
  if (searched.length) return searched;
  // RESTWS dispatches custom parameters to doSearch. Older ModelResource builds inherit
  // an empty implementation. Use only framework-special parameters to reach doGetAll.
  // Never substitute per-model requests, fabricate registry entries or suppress errors.
  const listed = await load(false);
  const query = q.trim().toLowerCase();
  return listed.filter(
    (model) =>
      (!query || `${model.name} ${model.code}`.toLowerCase().includes(query)) &&
      (!status || (status === 'RETIRED' ? model.retired : model.status === status)),
  );
}

export function useRegistry(q = '', status?: RegistryModel['status']) {
  return useSWR(['caremodels-registry', q, status ?? ''], () => fetchRegistryModels(q, status), {
    shouldRetryOnError: false,
  });
}

export function useWorkspaceTab(
  patientUuid: string,
  modelCode: string | null,
  tabId: string | null,
  memberUuid?: string,
) {
  const { mutate } = useSWRConfig();
  return useSWR<WorkspaceTab>(
    patientUuid && modelCode ? ['caremodels-workspace', patientUuid, modelCode, tabId ?? '', memberUuid ?? ''] : null,
    ([, uuid, code, tab]) => fetchWorkspaceTab(uuid as string, code as string, (tab as string) || null),
    {
      ...patientRequestOptions,
      onError: (error) => {
        if (isAuthorizationError(error))
          void mutate(
            (key) => Array.isArray(key) && key[0] === 'caremodels-memberships' && key[1] === patientUuid,
            undefined,
            { revalidate: true },
          );
      },
    },
  );
}

export function useWidgetData(patientUuid: string, modelCode: string, tabId: string, dataSource: string | null) {
  const { mutate } = useSWRConfig();
  const result = useSWR<DataResult>(
    patientUuid && modelCode && tabId && dataSource
      ? ['caremodels-data', patientUuid, modelCode, tabId, dataSource]
      : null,
    ([, uuid, code, tab, source]) => fetchWidgetData(uuid as string, code as string, tab as string, source as string),
    {
      ...patientRequestOptions,
      onError: (error) => {
        if (isAuthorizationError(error))
          void mutate(
            (key) =>
              Array.isArray(key) && ['caremodels-memberships', 'caremodels-workspace'].includes(key[0] as string),
            undefined,
            { revalidate: true },
          );
      },
    },
  );
  return { ...result, retry: () => result.mutate() };
}

// ========================
// Admin designer operations (POST /ws/rest/v1/caremodels/modeloperation)
// ========================

/** Writable fields from ModelOperationRequest.java; response-only fields are excluded. */
export type ModelOperationPayload =
  | { operation: 'create'; code: string; name: string; description?: string; privilege: string; definition: string }
  | { operation: 'saveDraft'; code: string; definition: string; expectedRevision: number }
  | { operation: 'validate'; definition: string }
  | { operation: 'publish'; code: string; version: string; expectedRevision: number }
  | { operation: 'envelope' | 'published' | 'deactivate' | 'reactivate'; code: string }
  | { operation: 'duplicate'; sourceCode: string; newCode: string; newName: string; privilege: string }
  | { operation: 'import'; code: string; name: string; privilege: string; envelope: string };

export interface OperationResult {
  name?: string;
  expectedRevision?: number;
  modelCode?: string;
  modelUuid?: string;
  status?: string;
  revision?: number;
  valid?: boolean;
  validationErrors?: string;
  conflict?: boolean;
  currentRevision?: number;
  envelope?: string;
}

export async function modelOperation(payload: ModelOperationPayload): Promise<OperationResult> {
  const { data } = await openmrsFetch<OperationResult>(`${careModelsBaseUrl}/modeloperation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data;
}

export function createModel(body: {
  code: string;
  name: string;
  description?: string;
  privilege: string;
  definition: object;
}) {
  return modelOperation({ operation: 'create', ...body, definition: JSON.stringify(body.definition) });
}

export function saveDraft(code: string, definition: object, expectedRevision: number) {
  return modelOperation({ operation: 'saveDraft', code, definition: JSON.stringify(definition), expectedRevision });
}

export function validateDefinition(definition: object) {
  return modelOperation({ operation: 'validate', definition: JSON.stringify(definition) });
}

export function publishModel(code: string, version: string, expectedRevision: number) {
  return modelOperation({ operation: 'publish', code, version, expectedRevision });
}

export function fetchEnvelope(code: string) {
  return modelOperation({ operation: 'envelope', code });
}

export function duplicateModel(sourceCode: string, newCode: string, newName: string, privilege: string) {
  return modelOperation({ operation: 'duplicate', sourceCode, newCode, newName, privilege });
}
export function importModel(code: string, name: string, privilege: string, envelope: object) {
  return modelOperation({ operation: 'import', code, name, privilege, envelope: JSON.stringify(envelope) });
}
export function changeModelStatus(code: string, operation: 'deactivate' | 'reactivate') {
  return modelOperation({ operation, code });
}
export async function fetchModel(code: string): Promise<RegistryModel> {
  const { data } = await openmrsFetch<RegistryModel>(
    `${careModelsBaseUrl}/model/${encodeURIComponent(code)}?v=default`,
  );
  return data;
}
export async function updateModelMetadata(
  code: string,
  metadata: { name: string; description: string; privilege: string },
) {
  const { data } = await openmrsFetch<RegistryModel>(`${careModelsBaseUrl}/model/${encodeURIComponent(code)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  return data;
}
export interface OpenmrsChoice {
  uuid: string;
  display: string;
  name?: string;
}
export async function fetchPrivileges(): Promise<Array<string>> {
  const { data } = await openmrsFetch<{ results: Array<{ name: string }> }>(
    `${restBaseUrl}/privilege?v=default&limit=1000`,
  );
  return data.results
    .map(({ name }) => name)
    .filter((name) => name !== masterPrivilege)
    .sort();
}
export function usePrivileges() {
  return useSWR('caremodels-privileges', fetchPrivileges);
}
export async function searchOpenmrsResources(
  resource: 'concept' | 'program' | 'encountertype' | 'form',
  q: string,
): Promise<Array<OpenmrsChoice>> {
  const { data } = await openmrsFetch<{ results: Array<OpenmrsChoice> }>(
    `${restBaseUrl}/${resource}?q=${encodeURIComponent(q)}&v=default&limit=50`,
  );
  return data.results;
}

/** Resolves the display name of a stored terminology reference by its exact UUID (plain REST read). */
export async function fetchOpenmrsResource(
  resource: 'concept' | 'program' | 'encountertype' | 'form',
  uuid: string,
): Promise<OpenmrsChoice> {
  const { data } = await openmrsFetch<OpenmrsChoice>(`${restBaseUrl}/${resource}/${encodeURIComponent(uuid)}?v=default`);
  return data;
}

/** Datatype detail of a stored concept reference, used to derive the read-only result type. */
export async function fetchConceptDetails(uuid: string): Promise<OpenmrsConcept> {
  const { data } = await openmrsFetch<OpenmrsConcept>(
    `${restBaseUrl}/concept/${encodeURIComponent(uuid)}?v=custom:(uuid,display,datatype:(uuid,display,name))`,
  );
  return data;
}

/** Custom core form representation supplied for Care Models form-alias configuration. */
export interface OpenmrsForm {
  uuid: string;
  name: string;
  encounterType?: { uuid: string; name: string } | null;
  version: string;
  published: boolean;
  retired: boolean;
  resources: Array<{ uuid: string; name: string; dataType: string; valueReference: string }>;
}
export const formRepresentation =
  'custom:(uuid,name,encounterType:(uuid,name),version,published,retired,resources:(uuid,name,dataType,valueReference))';

export async function fetchForms(): Promise<Array<OpenmrsForm>> {
  const forms = new Map<string, OpenmrsForm>();
  let startIndex = 0;
  for (;;) {
    const { data } = await openmrsFetch<RestCollection<OpenmrsForm>>(
      `${restBaseUrl}/form?v=${formRepresentation}&includeAll=true${startIndex ? `&startIndex=${startIndex}` : ''}`,
    );
    for (const form of data.results) forms.set(form.uuid, form);
    const next = nextRestPage(data, startIndex);
    if (next === null) return Array.from(forms.values());
    startIndex = next;
  }
}

/** Concept metadata used for exact terminology bindings; never a name-to-UUID guess. */
export interface OpenmrsConcept extends OpenmrsChoice {
  datatype?: { uuid: string; display: string; name?: string };
  conceptClass?: { uuid: string; display: string; name?: string };
  units?: string;
  answers?: Array<OpenmrsChoice>;
  mappings?: Array<{
    display?: string;
    conceptReferenceTerm?: { code?: string; conceptSource?: { display?: string } };
  }>;
}
export async function searchConcepts(q: string): Promise<Array<OpenmrsConcept>> {
  const representation =
    'custom:(uuid,display,datatype:(uuid,display,name),conceptClass:(uuid,display,name),units,answers:(uuid,display),mappings:(display,conceptReferenceTerm:(code,conceptSource:(display))))';
  const { data } = await openmrsFetch<{ results: Array<OpenmrsConcept> }>(
    `${restBaseUrl}/concept?q=${encodeURIComponent(q)}&v=${representation}&limit=50`,
  );
  return data.results;
}
