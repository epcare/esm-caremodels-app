import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecordSourceBuilder } from './record-source-builder.component';
import { blankDefinition } from './definition';
import { parseDefinitionJson } from './definition-validation';
it('creates a versioned conditions source and persists a compatible widget', () => {
  const definition = blankDefinition();
  definition.metadata.display.label = 'Example model';
  definition.workspace.tabs[0].widgets = [{ id: 'conditions', type: 'condition-list', dataSource: 'conditions' }];
  const save = vi.fn();
  render(
    <RecordSourceBuilder definition={definition} onSave={save} widget={definition.workspace.tabs[0].widgets[0]} />,
  );
  fireEvent.change(screen.getByLabelText('Data source key'), { target: { value: 'conditions' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create data source' }));
  const [saved, key] = save.mock.calls[0];
  expect(key).toBe('conditions');
  expect(saved.dataSources.conditions).toMatchObject({
    type: 'registered',
    resolverId: 'conditions',
    resolverVersion: '1.0.0',
    resultType: 'TABLE',
  });
  expect(parseDefinitionJson(JSON.stringify(saved)).errors).toEqual([]);
});
it('requires exact resource selection and rejects incompatible bindings', () => {
  render(
    <RecordSourceBuilder
      definition={blankDefinition()}
      onSave={vi.fn()}
      widget={{ id: 'program', type: 'program-summary' }}
    />,
  );
  fireEvent.change(screen.getByLabelText('Data source key'), { target: { value: 'program' } });
  expect(screen.getByRole('button', { name: 'Create data source' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Clinical record source'), { target: { value: 'program-state' } });
  expect(screen.getByRole('button', { name: 'Create data source' })).toBeDisabled();
});
