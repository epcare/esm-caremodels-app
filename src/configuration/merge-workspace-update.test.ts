import { hivUpdate } from './hiv-workspace-update.fixture';
import { parseDefinitionJson } from '../admin/designer/model/definition-validation';
import { mergeWorkspaceUpdate } from './merge-workspace-update.mjs';
import type { ModelDefinition } from '../types/caremodels';

const candidate = hivUpdate as ModelDefinition;

it('preserves enrollment policy, lifecycle and forms through repeated workspace imports', () => {
  const base = structuredClone(candidate);
  base.enrollment = { enabled: true, manualEnrollment: { enabled: true, requiresReason: true } };
  const first = mergeWorkspaceUpdate(base, candidate);
  const second = mergeWorkspaceUpdate(first, candidate);
  expect(second).toEqual(first);
  expect(second.enrollment).toEqual(base.enrollment);
  expect(second.lifecycle).toEqual(base.lifecycle);
  expect(second.forms).toEqual(base.forms);
  expect(parseDefinitionJson(JSON.stringify(second)).errors).toEqual([]);
});

it('requires catalog proof for new forms and rejects alias replacement or encounter mismatch', () => {
  const base = structuredClone(candidate);
  const form = base.forms.shift()!;
  const resource = {
    uuid: form.formUuid,
    published: true,
    retired: false,
    encounterType: { uuid: candidate.terminology.encounterTypes![form.encounterTypeAlias!] },
  };
  expect(() => mergeWorkspaceUpdate(base, candidate)).toThrow(/must be verified/);
  const merged = mergeWorkspaceUpdate(base, candidate, { verifiedForms: [resource] });
  expect(merged.forms).toEqual(expect.arrayContaining(base.forms));
  expect(merged.forms).toContainEqual(form);
  expect(parseDefinitionJson(JSON.stringify(merged)).errors).toEqual([]);
  expect(() => mergeWorkspaceUpdate(base, candidate, { verifiedForms: [{ ...resource, retired: true }] })).toThrow(
    /must be verified/,
  );
  expect(() =>
    mergeWorkspaceUpdate(base, candidate, { verifiedForms: [{ ...resource, encounterType: { uuid: 'different' } }] }),
  ).toThrow(/encounter-type mismatch/);
  base.forms.push({ ...form, formUuid: 'different' });
  expect(() => mergeWorkspaceUpdate(base, candidate, { verifiedForms: [resource] })).toThrow(/alias collision/);
});
