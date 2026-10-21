import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceEditor } from './workspace-editor.component';
import { blankDefinition } from './definition';

function Editor() {
  const initial = blankDefinition();
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
  expect(screen.getByText(/clinical data and actions are disabled/)).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
