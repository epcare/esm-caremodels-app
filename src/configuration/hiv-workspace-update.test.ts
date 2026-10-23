import update from '../../configuration/caremodel/hiv/hiv-workspace-update.json';
import correctedUpdate from '../../configuration/caremodel/hiv/hiv-care-simplified-corrected-workspace-update.json';
import { parseDefinitionJson } from '../admin/designer/definition-validation';
import { widgetBindingErrors, widgetManifest } from '../widgets/widget-registry';
import { mergeWorkspaceUpdate } from './merge-workspace-update.mjs';
import type { ModelDefinition } from '../types/caremodels';

const candidate = correctedUpdate as ModelDefinition;
it('keeps the corrected supplied-draft artifact aligned with the reviewed HIV workspace update', () => {
  expect(correctedUpdate).toEqual(update);
  expect(candidate.enrollment).toEqual({ enabled: false, triggers: [], rules: [] });
});
it('ships a designer-compatible eight-tab configuration with registered widgets and bounded responsive layouts', () => {
  expect(parseDefinitionJson(JSON.stringify(candidate)).errors).toEqual([]);
  expect(widgetBindingErrors(candidate)).toEqual([]);
  expect(candidate.workspace.defaultTab).toBe('overview');
  expect(candidate.workspace.tabs.map((tab) => tab.id)).toEqual([
    'overview',
    'art-regimens',
    'viral-load-iac',
    'clinical-assessment',
    'dsdm-psychosocial',
    'clinical-history',
    'forms-actions',
    'care-plan',
  ]);
  const ids = candidate.workspace.tabs.flatMap((tab) => tab.widgets.map((widget) => widget.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (const tab of candidate.workspace.tabs) {
    expect(tab.widgets.length).toBeLessThanOrEqual(50);
    for (const widget of tab.widgets) {
      expect(widgetManifest.some((manifest) => manifest.type === widget.type)).toBe(true);
      expect(widget.loadingPolicy).toBe('ON_VISIBLE');
      expect(tab.layouts?.wide?.filter((item) => item.widgetId === widget.id)).toHaveLength(1);
      expect(tab.layouts?.narrow?.filter((item) => item.widgetId === widget.id)).toHaveLength(1);
    }
  }
});
it('does not create unsafe current-regimen, independent DSDM approach or sensitive narrative bindings', () => {
  expect(candidate.dataSources.currentRegimen).toBeUndefined();
  expect(candidate.dataSources.artStatus).toBeUndefined();
  expect(candidate.dataSources.dsdmApproach).toBeUndefined();
  expect(candidate.dataSources.iacHistory).toBeUndefined();
  expect(candidate.dataSources.nutritionStatus).toBeUndefined();
  expect(candidate.pathways?.enabled).toBe(false);
  expect(candidate.actions.every((action) => action.type === 'launch-form')).toBe(true);
  expect(JSON.stringify(candidate)).not.toContain('159395AAAAAAAA');
  expect(JSON.stringify(candidate)).not.toContain('6649a671-32ea-45b7-adc5-bda1cff7febd');
  expect(JSON.stringify(candidate)).not.toContain('privilege');
});
it('preserves real form aliases, enrollment and lifecycle through repeated workspace imports', () => {
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
    encounterType: { uuid: candidate.terminology.encounterTypes!['hiv.artClinical'] },
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
