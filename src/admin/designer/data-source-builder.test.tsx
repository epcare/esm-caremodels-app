import React from 'react';
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataSourceBuilder, SourceSettings } from './data-source-builder.component';
import { blankDefinition } from './definition';

vi.mock('../concept-selector.component', () => ({
  ConceptSelector: ({ onSelect }) => (
    <>
      <button
        onClick={() =>
          onSelect({
            uuid: 'real-numeric-uuid',
            display: 'Blood pressure',
            datatype: { display: 'Numeric' },
            conceptClass: { display: 'Finding' },
            units: 'mmHg',
          })
        }>
        Pick numeric concept
      </button>
      <button
        onClick={() =>
          onSelect({
            uuid: 'real-coded-uuid',
            display: 'Clinical state',
            datatype: { display: 'Coded' },
            answers: [{ uuid: 'real-answer-uuid', display: 'Active' }],
          })
        }>
        Pick coded concept
      </button>
    </>
  ),
}));
it('creates bounded numeric history with the exact concept UUID and binds no arbitrary query', () => {
  const onSave = vi.fn();
  render(
    <DataSourceBuilder definition={blankDefinition()} widget={{ id: 'trend', type: 'trend-chart' }} onSave={onSave} />,
  );
  fireEvent.change(screen.getByLabelText('Data source key'), { target: { value: 'bloodPressure' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick numeric concept' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create data source', exact: true }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      terminology: expect.objectContaining({ concepts: { 'bloodPressure.concept': 'real-numeric-uuid' } }),
      dataSources: {
        bloodPressure: {
          type: 'latest-observation',
          conceptAlias: 'bloodPressure.concept',
          resultType: 'NUMBER',
          maxResults: 50,
          windowDays: 365,
          includeVoided: false,
          units: 'mmHg',
        },
      },
    }),
    'bloodPressure',
  );
});
it('blocks coded sources for trend charts and prevents replacing terminology bindings', () => {
  const definition = blankDefinition();
  definition.terminology.concepts = { existing: 'different-uuid' };
  render(<DataSourceBuilder definition={definition} widget={{ id: 'trend', type: 'trend-chart' }} onSave={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Data source key'), { target: { value: 'status' } });
  fireEvent.change(screen.getByLabelText('Concept alias'), { target: { value: 'existing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick coded concept' }));
  expect(screen.getByRole('button', { name: 'Create data source', exact: true })).toBeDisabled();
  expect(screen.getByText('Incompatible data source')).toBeInTheDocument();
});
it('does not alter a source in a way that breaks another bound widget', () => {
  const definition = blankDefinition();
  definition.dataSources.history = {
    type: 'historical-observations',
    conceptAlias: 'concept',
    resultType: 'NUMBER',
    maxResults: 50,
  };
  definition.workspace.tabs[0].widgets = [{ id: 'trend', type: 'trend-chart', dataSource: 'history' }];
  const onChange = vi.fn();
  render(<SourceSettings sourceKey="history" definition={definition} onChange={onChange} />);
  // Switching the strategy to latest-value caps results at 1, which breaks the bound chart.
  fireEvent.change(screen.getByLabelText('Selection strategy'), { target: { value: 'latest' } });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText('Source change was not applied')).toBeInTheDocument();
});
it('binds only selected coded answer UUIDs from the concept resource', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<DataSourceBuilder definition={blankDefinition()} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText('Data source key'), { target: { value: 'state' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick coded concept' }));
  await user.click(screen.getByRole('combobox', { name: /Valid coded answers/ }));
  await user.click(screen.getByRole('option', { name: /Active/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Create data source', exact: true }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      terminology: expect.objectContaining({
        codedAnswers: { 'state.concept.answer-real-answer-uuid': 'real-answer-uuid' },
      }),
    }),
    'state',
  );
});
