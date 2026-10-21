import { widgetManifest } from './widget-registry';
import { widgetPropertyErrors } from './widget-properties';
it.each(widgetManifest)('validates manifest defaults and metadata for $id', (manifest) => {
  expect(manifest.version).toBe('1.0.0');
  expect(manifest.propertiesSchema).toHaveProperty('properties');
  expect(manifest.description).not.toBe('');
  expect(
    widgetPropertyErrors({
      id: 'test',
      type: manifest.type,
      componentVersion: manifest.version,
      properties: manifest.properties,
    }),
  ).toEqual([]);
});
it.each([
  { precision: 10 },
  { chartType: 'pie' },
  { scaleType: 'invalid' },
  { columns: [{ field: 'diagnosis', label: 'Diagnosis' }] },
  { statusMappings: [{ value: 'x', label: 'X', tone: 'unknown' }] },
  { targetMin: 10, targetMax: 5 },
  { javascript: 'alert(1)' },
])('rejects invalid configuration %j', (properties) => {
  expect(widgetPropertyErrors({ id: 'test', type: 'metric', properties })).not.toEqual([]);
});
