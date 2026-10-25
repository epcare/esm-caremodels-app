import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { ModelPreview } from './model-preview.component';
import { blankDefinition } from '../model/definition';

it('renders registered widgets with synthetic results and sends no clinical requests', async () => {
  const definition = blankDefinition();
  definition.workspace.tabs[0].widgets = [
    { id: 'metric', type: 'metric', dataSource: 'example', properties: { title: 'Preview metric' } },
  ];
  definition.workspace.tabs.push({
    id: 'history',
    label: 'History',
    widgets: [{ id: 'table', type: 'clinical-table', dataSource: 'example', properties: { title: 'Preview table' } }],
  });
  render(<ModelPreview definition={definition} />);
  expect(screen.getByText('Demonstration data — not a patient record')).toBeInTheDocument();
  expect(await screen.findByText('12')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Workspace tab' }));
  fireEvent.click(screen.getByRole('option', { name: 'History' }));
  expect(await screen.findByText('Preview table')).toBeInTheDocument();
  expect(screen.getByText('18')).toBeInTheDocument();
  expect(openmrsFetch).not.toHaveBeenCalled();
});
