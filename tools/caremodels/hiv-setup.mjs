#!/usr/bin/env node
/** Update the existing HIV model through modeloperation. No INSERT, SQL configuration writes or checksums. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { mergeWorkspaceUpdate } from '../../src/configuration/merge-workspace-update.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const identity = Object.freeze({
  code: 'HIV',
  uuid: 'f33e4419-825f-4ce3-96c9-bc85f01cc2c2',
  name: 'HIV Patient Care',
  privilege: 'App: ugandaemr.artclinic',
});
export function assertIdentity(model) {
  for (const [key, value] of Object.entries(identity))
    if (model[key] !== value)
      throw new Error(`Existing model identity mismatch: ${key}. No model will be created or metadata changed.`);
  if (model.retired || model.status !== 'PUBLISHED')
    throw new Error('Expected the existing active PUBLISHED HIV model. Review its state first.');
}
export async function schemaValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const directory = resolve(packageRoot, 'src/admin/designer/schemas');
  for (const name of ['data-source', 'rule-expression', 'form-ref', 'action'])
    ajv.addSchema(JSON.parse(await readFile(resolve(directory, `${name}.schema.json`), 'utf8')));
  const validate = ajv.compile(JSON.parse(await readFile(resolve(directory, 'model-definition.schema.json'), 'utf8')));
  return (definition) => {
    if (!validate(definition))
      throw new Error(`Definition schema errors: ${ajv.errorsText(validate.errors, { separator: '\n' })}`);
  };
}
export function assertOperation(result) {
  if (result?.conflict)
    throw new Error(
      `Revision conflict: expected ${result.expectedRevision}, current ${result.currentRevision}. Your local candidate is preserved; fetch and review the latest envelope before retrying.`,
    );
  if (!result || result.error || result.validationErrors || result.valid === false)
    throw new Error(
      `Model operation failed: ${result?.validationErrors || result?.error?.message || 'invalid response'}`,
    );
  return result;
}
export async function prepareUpdate(api, update, persist) {
  const model = await api.get('/caremodels/model/HIV?v=default');
  assertIdentity(model);
  const result = assertOperation(await api.operation({ operation: 'envelope', code: 'HIV' }));
  if (typeof result.envelope !== 'string') throw new Error('Expected a JSON-string envelope.');
  const envelope = JSON.parse(result.envelope);
  if (
    envelope.storageSchemaVersion !== '1.0.0' ||
    !Number.isInteger(envelope.revision) ||
    envelope.revision !== model.revision ||
    envelope.revision < 0
  )
    throw new Error('Model/envelope revision mismatch; fetch again.');
  if (envelope.published?.version == null) throw new Error('Expected an existing published snapshot.');
  const base = envelope.draft?.definition ?? envelope.published?.definition;
  const needsAssociation = update.forms.some(
    (form) => !(base.forms ?? []).some((existing) => existing.formUuid === form.formUuid),
  );
  const verifiedForms = needsAssociation
    ? ((
        await api.get(
          '/form?v=custom:(uuid,name,encounterType:(uuid,name),version,published,retired,resources:(uuid,name,dataType,valueReference))&includeAll=true',
        )
      ).results ?? [])
    : [];
  const definition = mergeWorkspaceUpdate(base, update, { verifiedForms });
  // Persist the unchanged envelope backup and candidate BEFORE any network validation or write.
  await persist('hiv-envelope.before.json', envelope);
  await persist('hiv-definition.json', definition);
  await persist('hiv-identity.before.json', model);
  const validate = await schemaValidator();
  validate(definition);
  return { model, envelope, definition };
}
export async function verifyResources(api, definition) {
  const forms = (
    await api.get(
      '/form?v=custom:(uuid,name,encounterType:(uuid,name),version,published,retired,resources:(uuid,name,dataType,valueReference))&includeAll=true',
    )
  ).results;
  if (!Array.isArray(forms)) throw new Error('Expected a REST forms collection.');
  for (const form of definition.forms) {
    const actual = forms.find((item) => item.uuid === form.formUuid);
    if (!actual || actual.retired || !actual.published)
      throw new Error(`Form unavailable/unpublished/retired: ${form.alias} (${form.formUuid})`);
    if (
      form.encounterTypeAlias &&
      actual.encounterType?.uuid !== definition.terminology.encounterTypes?.[form.encounterTypeAlias]
    )
      throw new Error(`Form encounter-type mismatch: ${form.alias}`);
    if (!actual.resources?.length) throw new Error(`Form has no engine resources: ${form.alias}`);
  }
  const concepts = {};
  for (const uuid of new Set(Object.values(definition.terminology.concepts ?? {}))) {
    const concept = await api.get(`/concept/${encodeURIComponent(uuid)}?v=full`);
    if (concept.uuid !== uuid || concept.retired) throw new Error(`Concept unavailable: ${uuid}`);
    concepts[uuid] = concept;
  }
  const datatypes = { NUMBER: 'numeric', TIMESERIES: 'numeric', CODED: 'coded', DATE: 'date', STRING: 'text' };
  for (const [key, source] of Object.entries(definition.dataSources ?? {})) {
    if (!['latest-observation', 'historical-observations'].includes(source.type)) continue;
    const uuid = definition.terminology.concepts?.[source.conceptAlias];
    const actual = concepts[uuid];
    const type = (actual?.datatype?.name ?? actual?.datatype?.display ?? '').toLowerCase();
    const expected = datatypes[source.resultType];
    if (expected && !(expected === 'date' ? ['date', 'datetime'].includes(type) : type === expected))
      throw new Error(`Concept datatype mismatch for ${key}: expected ${expected}, got ${type || 'unknown'}`);
  }
  for (const uuid of new Set(Object.values(definition.terminology.encounterTypes ?? {}))) {
    const resource = await api.get(`/encountertype/${encodeURIComponent(uuid)}?v=default`);
    if (resource.uuid !== uuid || resource.retired) throw new Error(`Encounter type unavailable: ${uuid}`);
  }
  return {
    formsVerified: definition.forms.length,
    conceptsVerified: Object.keys(concepts).length,
    encounterTypesVerified: new Set(Object.values(definition.terminology.encounterTypes ?? {})).size,
  };
}
export async function saveReviewedDraft(api, prepared) {
  const validation = assertOperation(
    await api.operation({ operation: 'validate', definition: JSON.stringify(prepared.definition) }),
  );
  if (validation.valid !== true) throw new Error('Backend did not confirm valid=true.');
  // Detect changed identity/revision immediately before the revision-aware write.
  const current = await api.get('/caremodels/model/HIV?v=default');
  assertIdentity(current);
  if (current.revision !== prepared.envelope.revision)
    throw new Error('Revision changed during preparation. The local candidate is preserved.');
  const saved = assertOperation(
    await api.operation({
      operation: 'saveDraft',
      code: 'HIV',
      expectedRevision: prepared.envelope.revision,
      definition: JSON.stringify(prepared.definition),
    }),
  );
  if (!Number.isInteger(saved.revision) || saved.modelUuid !== identity.uuid || saved.modelCode !== identity.code)
    throw new Error('Unexpected save response. Stop and inspect the existing model; do not retry blindly.');
  return saved;
}
export async function publishReviewedDraft(api, prepared, saved, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('A semantic publication version is required.');
  const previous = prepared.envelope.published.version.split('.').map(Number);
  const proposed = version.split('.').map(Number);
  const first = proposed.findIndex((part, index) => part !== previous[index]);
  if (first < 0 || proposed[first] < previous[first]) throw new Error('The publication version must increase.');
  // The backend owns the checksum and repeats validation. A failure keeps the existing published snapshot.
  return assertOperation(
    await api.operation({ operation: 'publish', code: 'HIV', version, expectedRevision: saved.revision }),
  );
}
function argumentsOf(args) {
  const options = { baseUrl: 'http://localhost:8087/openmrs', out: resolve('/tmp', 'hiv-care-review') };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--save-draft') options.save = true;
    else if (arg === '--approve-publish') options.approvePublish = true;
    else if (['--base-url', '--out', '--envelope', '--model', '--publish-version'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[
        {
          '--base-url': 'baseUrl',
          '--out': 'out',
          '--envelope': 'envelope',
          '--model': 'model',
          '--publish-version': 'version',
        }[arg]
      ] = value;
    } else throw new Error(`Unknown option ${arg}`);
  }
  if (Boolean(options.envelope) !== Boolean(options.model))
    throw new Error('Offline preparation requires both --envelope and --model.');
  if (options.version && (!options.save || !options.approvePublish))
    throw new Error('Publication requires --save-draft --publish-version X.Y.Z --approve-publish.');
  if (options.approvePublish && !options.version) throw new Error('--approve-publish requires --publish-version.');
  if (options.envelope && (options.save || options.version)) throw new Error('Offline mode cannot save or publish.');
  return options;
}
async function main() {
  const options = argumentsOf(process.argv.slice(2));
  const root = new URL(options.baseUrl.replace(/\/$/, ''));
  if (!['http:', 'https:'].includes(root.protocol) || root.username || root.password || root.search || root.hash)
    throw new Error('Use an OpenMRS root URL without credentials, query or fragment.');
  const user = process.env.OPENMRS_USER,
    password = process.env.OPENMRS_PASSWORD,
    cookie = process.env.OPENMRS_COOKIE;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (user && password) headers.Authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  else if (cookie) headers.Cookie = cookie;
  else if (!options.envelope)
    throw new Error('Provide OPENMRS_USER and OPENMRS_PASSWORD or OPENMRS_COOKIE through your environment.');
  const request = async (path, payload) => {
    const response = await fetch(`${root.href.replace(/\/$/, '')}/ws/rest/v1${path}`, {
      method: payload ? 'POST' : 'GET',
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(
        `OpenMRS HTTP ${response.status} for ${path.split('?')[0]}. No automatic write retries are performed.`,
      );
    return response.json();
  };
  let api = { get: (path) => request(path), operation: (payload) => request('/caremodels/modeloperation', payload) };
  if (options.envelope) {
    const exported = JSON.parse(await readFile(resolve(options.envelope), 'utf8'));
    const envelope = typeof exported.envelope === 'string' ? JSON.parse(exported.envelope) : exported;
    const model = JSON.parse(await readFile(resolve(options.model), 'utf8'));
    api = { get: async () => model, operation: async () => ({ envelope: JSON.stringify(envelope) }) };
  }
  const destination = resolve(options.out);
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const persist = async (name, value) =>
    writeFile(resolve(destination, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  const update = JSON.parse(
    await readFile(resolve(packageRoot, 'configuration/hiv/hiv-workspace-update.json'), 'utf8'),
  );
  const prepared = await prepareUpdate(api, update, persist);
  if (options.envelope) {
    console.log(
      `Prepared offline candidate at ${destination}. Installation resources and backend validation remain unverified. No database changes.`,
    );
    return;
  }
  const resources = await verifyResources(api, prepared.definition);
  await persist('hiv-resource-verification.json', resources);
  const validation = assertOperation(
    await api.operation({ operation: 'validate', definition: JSON.stringify(prepared.definition) }),
  );
  await persist('hiv-validation.json', validation);
  if (validation.valid !== true) throw new Error('Backend did not confirm valid=true.');
  if (!options.save) {
    console.log(
      `Prepared and backend-validated candidate at ${destination}. No draft or published configuration changed.`,
    );
    return;
  }
  const saved = await saveReviewedDraft(api, prepared);
  await persist('hiv-save-result.json', saved);
  if (options.version) {
    const published = await publishReviewedDraft(api, prepared, saved, options.version);
    await persist('hiv-publish-result.json', published);
  }
  const after = await api.get('/caremodels/model/HIV?v=default');
  assertIdentity(after);
  await persist('hiv-identity.after.json', after);
  const result = assertOperation(await api.operation({ operation: 'envelope', code: 'HIV' }));
  await persist('hiv-envelope.after.json', JSON.parse(result.envelope));
  console.log(
    `Existing HIV model updated through the API. Review saved results at ${destination}. No identity, privilege, checksum or SQL configuration writes were performed.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
