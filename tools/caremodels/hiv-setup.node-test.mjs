import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeWorkspaceUpdate } from '../../src/configuration/merge-workspace-update.mjs';
import {
  identity,
  assertOperation,
  prepareUpdate,
  saveReviewedDraft,
  publishReviewedDraft,
  schemaValidator,
  verifyResources,
} from './hiv-setup.mjs';
const update = JSON.parse(
  await readFile(new URL('../../configuration/hiv/hiv-workspace-update.json', import.meta.url), 'utf8'),
);
const makeBase = () => ({
  ...structuredClone(update),
  enrollment: { enabled: true, manualEnrollment: { enabled: true, requiresReason: true } },
  lifecycle: { completion: { mode: 'MANUAL' }, onSourceCorrection: 'FLAG_FOR_REVIEW' },
});
const envelopeOf = (base) => ({
  storageSchemaVersion: '1.0.0',
  revision: 3,
  draft: { basedOnVersion: '1.0.0', definition: base },
  published: {
    version: '1.0.0',
    checksum: 'a'.repeat(64),
    publishedAt: '2026-01-01T00:00:00Z',
    definition: structuredClone(base),
  },
  history: [],
});
const model = { ...identity, status: 'PUBLISHED', revision: 3, retired: false };
test('shipped update passes the exact backend structural schemas', async () => {
  const validate = await schemaValidator();
  validate(update);
  assert.equal(update.workspace.tabs.length, 8);
  assert.equal(update.forms.length, 8);
});
test('merge preserves enrollment/lifecycle/existing forms and remaps existing aliases by UUID', () => {
  const base = makeBase();
  base.forms[0].alias = 'existing.art';
  base.terminology.forms['existing.art'] = base.forms[0].formUuid;
  delete base.terminology.forms['hiv.artClinical'];
  for (const action of base.actions) if (action.formAlias === 'hiv.artClinical') action.formAlias = 'existing.art';
  const original = structuredClone(base);
  const merged = mergeWorkspaceUpdate(base, update);
  assert.deepEqual(base, original);
  assert.deepEqual(merged.enrollment, base.enrollment);
  assert.deepEqual(merged.lifecycle, base.lifecycle);
  assert.deepEqual(merged.forms, base.forms);
  assert.equal(merged.actions.find((a) => a.id === 'hiv.recordArtVisit').formAlias, 'existing.art');
  assert.equal(
    merged.workspace.tabs
      .find((tab) => tab.id === 'forms-actions')
      .widgets.find((widget) => widget.id === 'forms-actions-form-artClinical').formAlias,
    'existing.art',
  );
});
test('unknown form UUID and source alias collisions fail closed', () => {
  const base = makeBase();
  base.forms = [];
  assert.throws(() => mergeWorkspaceUpdate(base, update), /must be verified/);
  const changed = makeBase();
  changed.terminology.concepts['hiv.latestViralLoad'] = 'different';
  assert.throws(() => mergeWorkspaceUpdate(changed, update), /collision/);
});
test('preparation backs up the real envelope, uses returned revision and performs no write operation', async () => {
  const envelope = envelopeOf(makeBase());
  const calls = [];
  const files = {};
  const api = {
    get: async () => model,
    operation: async (payload) => {
      calls.push(payload);
      return { envelope: JSON.stringify(envelope) };
    },
  };
  const prepared = await prepareUpdate(api, update, async (name, data) => {
    files[name] = structuredClone(data);
  });
  assert.equal(prepared.envelope.revision, 3);
  assert.deepEqual(calls, [{ operation: 'envelope', code: 'HIV' }]);
  assert.deepEqual(files['hiv-envelope.before.json'], envelope);
  assert.deepEqual(files['hiv-definition.json'].enrollment, envelope.draft.definition.enrollment);
});
test('save sends a definition string and actual numeric revision; conflicts preserve the candidate', async () => {
  const prepared = { envelope: envelopeOf(makeBase()), definition: makeBase() };
  const before = structuredClone(prepared.definition);
  const calls = [];
  const api = {
    get: async () => model,
    operation: async (payload) => {
      calls.push(payload);
      return payload.operation === 'validate'
        ? { valid: true }
        : { conflict: true, expectedRevision: 3, currentRevision: 4 };
    },
  };
  await assert.rejects(() => saveReviewedDraft(api, prepared), /Revision conflict/);
  assert.equal(calls[1].operation, 'saveDraft');
  assert.equal(typeof calls[1].definition, 'string');
  assert.equal(calls[1].expectedRevision, 3);
  assert.deepEqual(prepared.definition, before);
  assert.ok(!calls.some((call) => call.operation === 'publish'));
});
test('validation failure prevents saving and publishing', async () => {
  const calls = [];
  const api = {
    operation: async (payload) => {
      calls.push(payload);
      return { valid: false, validationErrors: '$.dataSources: unknown reference' };
    },
  };
  await assert.rejects(() => saveReviewedDraft(api, { definition: update }), /unknown reference/);
  assert.equal(calls.length, 1);
});
test('publication uses the saved revision and never writes a checksum', async () => {
  const calls = [];
  const api = {
    operation: async (payload) => {
      calls.push(payload);
      return { modelCode: 'HIV', modelUuid: identity.uuid, revision: 5 };
    },
  };
  await publishReviewedDraft(api, { envelope: { published: { version: '1.0.0' } } }, { revision: 4 }, '1.1.0');
  assert.deepEqual(calls, [{ operation: 'publish', code: 'HIV', version: '1.1.0', expectedRevision: 4 }]);
});
test('an error response cannot be mistaken for a successful operation', () => {
  assert.throws(() => assertOperation({ valid: false }), /failed/);
  assert.throws(() => assertOperation({ conflict: true, currentRevision: 9 }), /conflict/);
});
test('installation resource preflight checks exact UUIDs and actual concept datatypes', async () => {
  const forms = update.forms.map((form) => ({
    uuid: form.formUuid,
    published: true,
    retired: false,
    encounterType: { uuid: update.terminology.encounterTypes[form.encounterTypeAlias] },
    resources: [{ name: 'json' }],
  }));
  const types = { NUMBER: 'Numeric', CODED: 'Coded', DATE: 'Date' };
  const byUuid = {};
  for (const source of Object.values(update.dataSources))
    if (source.conceptAlias) byUuid[update.terminology.concepts[source.conceptAlias]] = types[source.resultType];
  const api = {
    get: async (path) => {
      if (path.startsWith('/form?')) return { results: forms };
      const uuid = decodeURIComponent(path.split('/')[2].split('?')[0]);
      return { uuid, retired: false, ...(path.startsWith('/concept/') ? { datatype: { name: byUuid[uuid] } } : {}) };
    },
  };
  const result = await verifyResources(api, update);
  assert.equal(result.formsVerified, 8);
  assert.equal(result.conceptsVerified, Object.keys(update.terminology.concepts).length);
  await assert.rejects(
    () =>
      verifyResources(
        {
          get: async (path) =>
            path.startsWith('/form?')
              ? { results: forms }
              : { uuid: decodeURIComponent(path.split('/')[2].split('?')[0]), datatype: { name: 'Text' } },
        },
        update,
      ),
    /datatype mismatch/,
  );
});
test('SQL companion contains only session variables and read queries', async () => {
  const sql = await readFile(new URL('../../configuration/hiv/verify-existing-hiv.mysql.sql', import.meta.url), 'utf8');
  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.ok(!/\b(INSERT|UPDATE|REPLACE|DELETE|CREATE|ALTER|DROP)\b/i.test(statements));
  assert.ok(statements.includes(identity.uuid));
  assert.ok(statements.includes(identity.privilege));
});
test('preparation can associate a missing form only using the live catalog response', async () => {
  const base = makeBase();
  const form = base.forms.shift();
  const envelope = envelopeOf(base);
  let lookups = 0;
  const api = {
    get: async (path) => {
      if (path.startsWith('/form?')) {
        lookups++;
        return {
          results: [
            {
              uuid: form.formUuid,
              published: true,
              retired: false,
              encounterType: { uuid: update.terminology.encounterTypes[form.encounterTypeAlias] },
            },
          ],
        };
      }
      return model;
    },
    operation: async () => ({ envelope: JSON.stringify(envelope) }),
  };
  const prepared = await prepareUpdate(api, update, async () => {});
  assert.equal(lookups, 1);
  assert.equal(prepared.definition.forms.length, 8);
  for (const original of base.forms)
    assert.deepEqual(
      prepared.definition.forms.find((item) => item.alias === original.alias),
      original,
    );
});
