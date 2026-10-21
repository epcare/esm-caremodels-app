import { manifestFor, sourceCompatibility, widgetBindingErrors, widgetManifest } from './widget-registry';
import { blankDefinition } from '../admin/designer/definition';

it('registers supported widgets with dimensions, properties and preview fixtures', () => {
  for (const manifest of widgetManifest) {
    expect(manifest.dimensions.w).toBeGreaterThan(0);
    expect(manifest.configurable).toContain('title');
    expect(manifest.fixture.values?.length).toBeGreaterThan(0);
  }
  expect(manifestFor({ id: 'status', type: 'metric', properties: { presentation: 'status' } })?.id).toBe(
    'clinical-status',
  );
});
it('enforces result shapes and bounded numeric history without composite sources', () => {
  const source = {
    type: 'latest-observation' as const,
    resultType: 'NUMBER' as const,
    conceptAlias: 'concept',
    maxResults: 20,
  };
  expect(sourceCompatibility({ id: 'chart', type: 'trend-chart' }, source)).toBeNull();
  expect(sourceCompatibility({ id: 'chart', type: 'trend-chart' }, { ...source, maxResults: 1 })).toMatch(/multiple/);
  expect(sourceCompatibility({ id: 'chart', type: 'trend-chart' }, { ...source, resultType: 'CODED' })).not.toBeNull();
  expect(sourceCompatibility({ id: 'form', type: 'form-launcher' })).toBeNull();
  expect(
    sourceCompatibility({ id: 'status', type: 'metric', properties: { presentation: 'status' } }, source),
  ).not.toBeNull();
});
it('reports a selected tab binding path before validate/publish', () => {
  const definition = blankDefinition();
  definition.workspace.tabs[0].widgets = [{ id: 'metric', type: 'metric', dataSource: 'missing' }];
  expect(widgetBindingErrors(definition)[0]).toMatch(/^\$\.workspace.tabs\[0\].widgets\[0\].dataSource/);
});
