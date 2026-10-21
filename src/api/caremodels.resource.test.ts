import { openmrsFetch } from '@openmrs/esm-framework';
import {
  createModel,
  fetchMemberships,
  fetchWorkspaceTab,
  fetchWidgetData,
  saveDraft,
  publishModel,
  importModel,
  duplicateModel,
  changeModelStatus,
  hasMasterPrivilege,
} from './caremodels.resource';
import { parseDataResult, parseEnvelope } from './contract';

const fetch = vi.mocked(openmrsFetch);
const respond = (data: unknown) => fetch.mockResolvedValueOnce({ data } as never);
const workspace = {
  modelCode: 'test',
  modelUuid: 'm',
  memberUuid: 'mbr',
  tabId: 'overview',
  tabLabel: 'Overview',
  widgets: [],
  tabs: [{ id: 'overview', label: 'Overview' }],
};

it('requests membership default representation without registry or data calls', async () => {
  respond({ results: [{ modelCode: 'test' }] });
  expect(await fetchMemberships('patient/a')).toEqual([{ modelCode: 'test' }]);
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/ws/rest/v1/caremodels/membership?patient=patient%2Fa&v=default');
});

it('omits the initial tab, requests default representation, and handles REST collections', async () => {
  respond({ results: [workspace] });
  expect(await fetchWorkspaceTab('p', 'test', null)).toEqual(workspace);
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('model=test&v=default'));
  respond([workspace]);
  await fetchWorkspaceTab('p', 'test', 'clinical history');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('tab=clinical%20history&v=default'));
  respond({ results: [] });
  await expect(fetchWorkspaceTab('p', 'test', null)).rejects.toThrow();
});

it('posts one tab-bound source and validates resultJson', async () => {
  const result = { type: 'latest-observation', values: [{ obsUuid: 'obs', valueType: 'NUMBER', value: 12 }] };
  respond({ resultJson: JSON.stringify(result) });
  expect(await fetchWidgetData('p', 'test', 'overview', 'source')).toEqual(result);
  expect(fetch).toHaveBeenLastCalledWith(
    expect.stringContaining('/data'),
    expect.objectContaining({
      body: JSON.stringify({ patient: 'p', model: 'test', tab: 'overview', dataSource: 'source' }),
    }),
  );
  for (const bad of [
    null,
    '{}',
    'null',
    '{',
    JSON.stringify({ type: 'test', values: [{ obsUuid: 'o', valueType: 'NUMBER', value: 'wrong' }] }),
  ]) {
    expect(() => parseDataResult(bad)).toThrow();
  }
});

it('serializes definition/envelope as strings and revisions as numbers', async () => {
  const definition = { schemaVersion: '1.0.0' };
  respond({ modelCode: 'test', revision: 1 });
  await createModel({ code: 'test', name: 'Test', privilege: 'View Test', definition });
  expect(JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string)).toEqual({
    operation: 'create',
    code: 'test',
    name: 'Test',
    privilege: 'View Test',
    definition: JSON.stringify(definition),
  });
  respond({ conflict: true, expectedRevision: 1, currentRevision: 3 });
  expect(await saveDraft('test', definition, 1)).toMatchObject({ conflict: true, currentRevision: 3 });
  expect(JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string).expectedRevision).toBe(1);
  respond({ revision: 4 });
  await publishModel('test', '1.1.0', 3);
  expect(JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string)).toEqual({
    operation: 'publish',
    code: 'test',
    version: '1.1.0',
    expectedRevision: 3,
  });
  respond({});
  await importModel('test', 'Test', 'View Test', { revision: 0 });
  expect(JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string).envelope).toBe('{"revision":0}');
  respond({});
  await duplicateModel('test', 'copy', 'Copy', 'View Copy');
  expect(JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string)).toEqual({
    operation: 'duplicate',
    sourceCode: 'test',
    newCode: 'copy',
    newName: 'Copy',
    privilege: 'View Copy',
  });
  respond({});
  await changeModelStatus('test', 'deactivate');
  expect(JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string)).toEqual({ operation: 'deactivate', code: 'test' });
});

it('fails closed on unauthenticated sessions and invalid envelopes', () => {
  expect(
    hasMasterPrivilege({
      authenticated: false,
      user: { uuid: 'u', display: 'U', privileges: [{ name: 'View Care Models' }] },
    }),
  ).toBe(false);
  expect(() => parseEnvelope('{}')).toThrow();
});

it('loads a complete registry prefix even when DAO paging suppresses the next link', async () => {
  const { fetchRegistryModels } = await import('./caremodels.resource');
  const firstPage = Array.from({ length: 100 }, (_, i) => ({ uuid: `model-${i}` }));
  respond({ results: firstPage });
  respond({ results: [...firstPage, { uuid: 'last-model' }] });
  const models = await fetchRegistryModels('test name');
  expect(models).toHaveLength(101);
  expect(fetch.mock.calls.at(-2)![0]).toContain('startIndex=0&limit=100');
  expect(fetch.mock.calls.at(-2)![0]).toContain('q=test%20name');
  expect(fetch.mock.calls.at(-1)![0]).toContain('startIndex=0&limit=200');
  expect(fetch.mock.calls.at(-1)![0]).toContain('q=test%20name');
});

it('preserves server validation paths and messages', async () => {
  const { validateDefinition } = await import('./caremodels.resource');
  respond({ valid: false, validationErrors: '$.workspace.tabs[0].widgets[0].dataSource: Alias is missing' });
  expect(await validateDefinition({ schemaVersion: '1.0.0' })).toEqual({
    valid: false,
    validationErrors: '$.workspace.tabs[0].widgets[0].dataSource: Alias is missing',
  });
  expect(JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string)).toEqual({
    operation: 'validate',
    definition: '{"schemaVersion":"1.0.0"}',
  });
});

it('follows membership REST paging without dropping active models or changing the patient', async () => {
  respond({
    results: [{ memberUuid: 'first', modelCode: 'one' }],
    links: [
      { rel: 'next', uri: 'http://server/openmrs/ws/rest/v1/caremodels/membership?patient=patient&startIndex=50' },
    ],
  });
  respond({ results: [{ memberUuid: 'second', modelCode: 'two' }] });
  expect(await fetchMemberships('patient/a')).toEqual([
    { memberUuid: 'first', modelCode: 'one' },
    { memberUuid: 'second', modelCode: 'two' },
  ]);
  expect(fetch.mock.calls.at(-1)![0]).toBe(
    '/ws/rest/v1/caremodels/membership?patient=patient%2Fa&v=default&startIndex=50',
  );
});

it('rejects invalid REST paging links rather than repeating requests', async () => {
  respond({ results: [], links: [{ rel: 'next', uri: '/membership?startIndex=0' }] });
  await expect(fetchMemberships('patient')).rejects.toThrow('invalid next page');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('keeps metadata updates outside the definition and requests the existing model resource', async () => {
  const { fetchModel, updateModelMetadata } = await import('./caremodels.resource');
  respond({ code: 'model/a' });
  await fetchModel('model/a');
  expect(fetch).toHaveBeenLastCalledWith('/ws/rest/v1/caremodels/model/model%2Fa?v=default');
  respond({ code: 'model/a' });
  await updateModelMetadata('model/a', { name: 'Model', description: 'Description', privilege: 'View Model' });
  expect(fetch).toHaveBeenLastCalledWith(
    '/ws/rest/v1/caremodels/model/model%2Fa',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Model', description: 'Description', privilege: 'View Model' }),
    }),
  );
});

it('passes supported status filters on the registry request', async () => {
  const { fetchRegistryModels } = await import('./caremodels.resource');
  respond({ results: [] });
  respond({ results: [] });
  await fetchRegistryModels('test', 'INACTIVE');
  expect(fetch.mock.calls.at(-2)![0]).toContain('q=test&status=INACTIVE');
});

it('searches real concept metadata using the existing OpenMRS concept resource', async () => {
  const { searchConcepts } = await import('./caremodels.resource');
  respond({ results: [{ uuid: 'exact-uuid', display: 'BP', datatype: { display: 'Numeric' }, units: 'mmHg' }] });
  const concepts = await searchConcepts('blood pressure');
  expect(concepts[0].uuid).toBe('exact-uuid');
  expect(fetch).toHaveBeenLastCalledWith(
    expect.stringContaining('/concept?q=blood%20pressure&v=custom:(uuid,display,datatype:'),
  );
  expect(fetch.mock.calls.at(-1)![0]).toContain('answers:(uuid,display)');
  expect(fetch.mock.calls.at(-1)![0]).toContain('units');
});

it('rejects numeric qualifier metadata without a supported backend qualifier contract', () => {
  expect(() =>
    parseDataResult(
      JSON.stringify({
        type: 'latest-observation',
        values: [{ obsUuid: 'obs', valueType: 'NUMBER', value: 50, qualifier: '<' }],
      }),
    ),
  ).toThrow('Invalid Care Models clinical result');
  expect(
    parseDataResult(
      JSON.stringify({ type: 'latest-observation', values: [{ obsUuid: 'obs', valueType: 'STRING', value: '<50' }] }),
    ).values?.[0].value,
  ).toBe('<50');
});

it('recovers registry records when custom search parameters hit the inherited empty search handler', async () => {
  const { fetchRegistryModels } = await import('./caremodels.resource');
  respond({ results: [] });
  const model = {
    uuid: 'model',
    code: 'HIV',
    name: 'HIV Patient Care',
    privilege: 'View HIV',
    status: 'PUBLISHED',
    revision: 4,
    retired: false,
  };
  respond({ results: [model] });
  expect(await fetchRegistryModels('')).toEqual([model]);
  expect(fetch.mock.calls.at(-1)).toEqual([
    '/ws/rest/v1/caremodels/model?includeAll=true&v=default&startIndex=0&limit=100',
    { cache: 'no-store' },
  ]);
  expect(fetch.mock.calls.at(-2)![1]).toEqual({ cache: 'no-store' });
});
it('applies registry search and status filters locally when the legacy search handler is empty', async () => {
  const { fetchRegistryModels } = await import('./caremodels.resource');
  respond({ results: [] });
  respond({
    results: [
      { uuid: 'hiv', code: 'HIV', name: 'HIV care', status: 'PUBLISHED' },
      { uuid: 'tb', code: 'TB', name: 'TB care', status: 'DRAFT' },
    ],
  });
  expect(await fetchRegistryModels('hiv', 'PUBLISHED')).toEqual([expect.objectContaining({ code: 'HIV' })]);
});
it('does not translate malformed registry responses or fallback failures into an empty registry', async () => {
  const { fetchRegistryModels } = await import('./caremodels.resource');
  respond({ unexpected: [] });
  await expect(fetchRegistryModels('')).rejects.toThrow('Invalid Care Models registry response');
  respond({ results: [] });
  fetch.mockRejectedValueOnce(new Error('backend unavailable'));
  await expect(fetchRegistryModels('')).rejects.toThrow('backend unavailable');
});
