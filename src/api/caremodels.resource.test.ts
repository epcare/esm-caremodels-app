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
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    '/openmrs/ws/rest/v1/caremodels/membership?patient=patient%2Fa&v=default',
  );
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
  expect(fetch.mock.calls.at(-2)![0]).toContain('startIndex=0&limit=100&q=test%20name');
  expect(fetch.mock.calls.at(-1)![0]).toContain('startIndex=0&limit=200&q=test%20name');
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
