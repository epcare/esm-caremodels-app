import { parseDefinitionJson } from './definition-validation';
import { blankDefinition } from './definition';

it('accepts the backend schema and reports syntax locations', () => {
  const definition = blankDefinition();
  definition.metadata.display.label = 'Example';
  expect(parseDefinitionJson(JSON.stringify(definition)).definition).toEqual(definition);
  expect(parseDefinitionJson('{\n "metadata": }').errors.join()).toMatch(/line 2, column/);
});
it('rejects malformed configuration and forbidden security fields before visual state changes', () => {
  const definition = blankDefinition();
  definition.metadata.display.label = 'Example';
  for (const extra of [{ privilege: 'View Test' }, { facility: 'facility' }, { patient: 'patient' }]) {
    expect(parseDefinitionJson(JSON.stringify({ ...definition, ...extra })).definition).toBeUndefined();
  }
  definition.workspace.tabs[0].widgets.push({ id: 'test', type: 'metric', position: { col: 0, row: 0, w: 6, h: 2 } });
  const source = JSON.stringify(definition, null, 2);
  const line = source.split('\n').findIndex((text) => text.includes('"col": 0')) + 1;
  expect(parseDefinitionJson(source).errors.join()).toContain(`line ${line}, column`);
  expect(parseDefinitionJson(source).errors.join()).toMatch(
    /\/workspace\/tabs\/0\/widgets\/0\/position\/col \(line \d+, column/,
  );
});
