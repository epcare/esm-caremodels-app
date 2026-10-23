import { manifestFor, sourceCompatibility, widgetBindingErrors, widgetManifest } from './widget-registry';
import { blankDefinition } from '../admin/designer/definition';

it('registers supported widgets with dimensions, properties and preview fixtures', () => {
  for (const manifest of widgetManifest) {
    expect(manifest.dimensions.w).toBeGreaterThan(0);
    expect(manifest.configurable.length).toBeGreaterThan(0);
    expect(manifest.fixture.type).toBeTruthy();
  }
  expect(manifestFor({ id: 'status', type: 'metric', properties: { presentation: 'status' } })?.id).toBe(
    'clinical-status',
  );
  expect(manifestFor({ id: 'kv', type: 'metric', properties: { presentation: 'key-value' } })?.id).toBe(
    'key-value-metric',
  );
  expect(manifestFor({ id: 'date', type: 'metric', properties: { presentation: 'date' } })?.id).toBe('date-metric');
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
it('allows a one-record collection source for tables while preserving chart history constraints', () => {
  const source = {
    type: 'latest-observation' as const,
    conceptAlias: 'concept',
    resultType: 'NUMBER' as const,
    maxResults: 1,
  };
  expect(sourceCompatibility({ id: 'table', type: 'clinical-table' }, source)).toBeNull();
  expect(sourceCompatibility({ id: 'chart', type: 'trend-chart' }, source)).not.toBeNull();
});
it('represents all catalog entries across enabled and blocked palette entries', async () => {
  const { unavailableWidgets } = await import('./widget-registry');
  // 25 briefs plus the Key Value Pair and Date Metric metric-presentation profiles.
  expect(widgetManifest.length + unavailableWidgets.length).toBe(27);
});
it('rebinds an observation table to typed fields without retaining incompatible columns or units', async () => {
  const { bindWidgetSource } = await import('./widget-registry');
  const updated = bindWidgetSource(
    {
      id: 'table',
      type: 'clinical-table',
      dataSource: 'old',
      properties: { unit: 'mmHg', sortBy: 'value', columns: [{ field: 'value', label: 'Value' }] },
    },
    'conditions',
    { type: 'registered', resolverId: 'conditions', resolverVersion: '1.0.0', resultType: 'TABLE' },
  );
  expect(updated.properties?.unit).toBeUndefined();
  expect(updated.properties?.columns).toBeUndefined();
  expect(updated.properties?.sortBy).toBeUndefined();
});
