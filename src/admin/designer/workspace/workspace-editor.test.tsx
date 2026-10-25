import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { WorkspaceEditor } from './workspace-editor.component';
import { parseDefinitionJson } from '../model/definition-validation';
import { blankDefinition } from '../model/definition';

function Editor() {
  const initial = blankDefinition();
  initial.metadata.display.label = 'Test';
  initial.workspace.tabs.push({ id: 'history', label: 'History', widgets: [{ id: 'history-metric', type: 'metric' }] });
  const [definition, setDefinition] = useState(initial);
  return (
    <>
      <WorkspaceEditor definition={definition} onChange={setDefinition} />
      <output data-testid="definition">{JSON.stringify(definition)}</output>
    </>
  );
}
it('adds a widget in the current tab and preserves other tabs', () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: 'Clinical Metric', exact: true }));
  const definition = JSON.parse(screen.getByTestId('definition').textContent!);
  expect(definition.workspace.tabs[0].widgets).toHaveLength(1);
  expect(definition.workspace.tabs[1].widgets[0].id).toBe('history-metric');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed metric' } });
  expect(JSON.parse(screen.getByTestId('definition').textContent!).workspace.tabs[0].widgets[0].properties.title).toBe(
    'Renamed metric',
  );
});
it('resizes a canvas widget by dragging its corner and persists the resulting grid dimensions', () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: 'Clinical Metric', exact: true }));
  const handle = screen.getByRole('button', { name: 'Resize Clinical Metric' });
  const canvasGrid = screen.getByTestId('workspace-canvas') as HTMLDivElement;
  Object.defineProperty(canvasGrid, 'clientWidth', { configurable: true, value: 1200 });
  canvasGrid.style.gridTemplateColumns = Array(12).fill('100px').join(' ');
  canvasGrid.style.gridTemplateRows = '32px 32px 32px 32px';
  canvasGrid.style.columnGap = '0px';
  canvasGrid.style.rowGap = '16px';
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100, clientY: 48 });
  fireEvent.pointerUp(handle, { pointerId: 1 });

  const definition = JSON.parse(screen.getByTestId('definition').textContent!);
  const widgetId = definition.workspace.tabs[0].widgets[0].id;
  expect(definition.workspace.tabs[0].layouts.wide.find((item) => item.widgetId === widgetId)).toMatchObject({
    w: 7,
    h: 4,
  });
  expect(screen.getByLabelText('Width')).toHaveValue(7);
  expect(screen.getByLabelText('Height')).toHaveValue(4);
});
it('adds/removes sections while preserving a valid default tab', () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
  expect(JSON.parse(screen.getByTestId('definition').textContent!).workspace.tabs).toHaveLength(3);
  fireEvent.click(screen.getByLabelText('Default section'));
  fireEvent.click(screen.getByRole('button', { name: /Remove section/ }));
  const definition = JSON.parse(screen.getByTestId('definition').textContent!);
  expect(definition.workspace.tabs).toHaveLength(2);
  expect(definition.workspace.defaultTab).toBe('overview');
});
it('preview cannot add widgets or execute patient APIs', () => {
  const onChange = vi.fn();
  render(<WorkspaceEditor definition={blankDefinition()} onChange={onChange} preview />);
  expect(screen.queryByRole('button', { name: 'Clinical Metric' })).not.toBeInTheDocument();
  expect(screen.getByText('Demonstration data — not a patient record')).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
it('uses shared realistic previews with no clinical API calls and exposes inspector tabs', () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: 'Clinical Status', exact: true }));
  expect(screen.getByText('Preview data')).toBeInTheDocument();
  expect(screen.getByText('Active')).toBeInTheDocument();
  expect(openmrsFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('tab', { name: 'Content' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Data source' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
  expect(screen.getByLabelText('Empty-state text')).toBeInTheDocument();
  const definition = JSON.parse(screen.getByTestId('definition').textContent!);
  expect(definition.workspace.tabs[0].widgets[0]).toMatchObject({
    type: 'metric',
    properties: { presentation: 'status' },
  });
  expect(definition.workspace.tabs[0].widgets[0]).not.toHaveProperty('dataSource');
});

vi.mock('../../concept-selector.component', () => ({
  ConceptSelector: ({ onSelect }) => (
    <button
      onClick={() =>
        onSelect({
          uuid: '11111111-1111-4111-8111-111111111111',
          display: 'Height',
          datatype: { display: 'Numeric' },
          units: 'cm',
        })
      }>
      Select real height concept
    </button>
  ),
}));
it('creates and binds a source atomically from the inspector and preserves a compatible JSON document', () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: 'Clinical Metric', exact: true }));
  fireEvent.click(screen.getByRole('tab', { name: 'Data source' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create data source', exact: true }));
  fireEvent.change(screen.getByLabelText('Data source key'), { target: { value: 'height' } });
  fireEvent.click(screen.getByRole('button', { name: 'Select real height concept' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create data source', exact: true }));
  const definition = JSON.parse(screen.getByTestId('definition').textContent!);
  expect(definition.dataSources.height).toMatchObject({
    type: 'latest-observation',
    resultType: 'NUMBER',
    conceptAlias: 'height.concept',
  });
  expect(definition.terminology.concepts['height.concept']).toBe('11111111-1111-4111-8111-111111111111');
  expect(definition.workspace.tabs[0].widgets[0]).toMatchObject({ dataSource: 'height', properties: { unit: 'cm' } });
  expect(parseDefinitionJson(JSON.stringify(definition)).errors).toEqual([]);
  expect(definition.workspace.tabs[1].widgets[0].id).toBe('history-metric');
});
it('duplicates a configured widget with a new ID and removes only the selected copy', async () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole('button', { name: 'Clinical Metric', exact: true }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Authored title' } });
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate widget' }));
  const definition = JSON.parse(screen.getByTestId('definition').textContent!);
  expect(definition.workspace.tabs[0].widgets).toHaveLength(2);
  expect(definition.workspace.tabs[0].widgets[0].id).not.toBe(definition.workspace.tabs[0].widgets[1].id);
  expect(definition.workspace.tabs[0].widgets[1].properties.title).toBe('Authored title');
  fireEvent.click(await screen.findByRole('button', { name: /Remove widget/ }));
  expect(JSON.parse(screen.getByTestId('definition').textContent!).workspace.tabs[0].widgets).toHaveLength(1);
});
