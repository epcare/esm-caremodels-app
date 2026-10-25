import React from 'react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { DataSourceBuilder } from './data-source-builder.component';
import { SetSourceBuilder, } from './data-source-set-builder.component';
import { blankDefinition } from '../model/definition';

vi.mock('../../concept-selector.component', () => ({
  ConceptSelector: ({ onSelect }) => (
    <button onClick={() => onSelect({ uuid: '1eb05918-f50c-4cad-a827-3c78f296a10a', display: 'Renal Function Panel', datatype: { display: 'N/A' } })}>
      Pick set concept
    </button>
  ),
}));

vi.mock('../../../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchConceptSetDetails: vi.fn().mockResolvedValue({
    uuid: 'renal-set-uuid',
    display: 'Renal Function Panel',
    datatype: { display: 'N/A' },
    conceptClass: { display: 'LabSet' },
    set: true,
    setMembers: [
      { uuid: 'crea-uuid', display: 'Creatinine', datatype: { display: 'Numeric' }, conceptClass: { display: 'LabTest' } },
      { uuid: 'stage-uuid', display: 'WHO Stage', datatype: { display: 'Coded' }, conceptClass: { display: 'Question' } },
      { uuid: 'notes-uuid', display: 'Clinical Notes', datatype: { display: 'Text' }, conceptClass: { display: 'Misc' } },
    ],
    names: [{ name: 'RFT', conceptNameType: 'SYNONYM' }],
  }),
}));

const definition = blankDefinition();
const FreshCache = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

it('walks the five-step grouped-set flow and saves an observation-set source with membership', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<FreshCache><SetSourceBuilder definition={definition} onSave={onSave} /></FreshCache>);
  // Step 1: basic information
  await user.type(screen.getByLabelText('Data source key'), 'renalPanelResults');
  await user.type(screen.getByLabelText('Display name'), 'Renal Function Panel');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  // Step 2: parent concept — set membership, not datatype, qualifies
  await user.click(screen.getByRole('button', { name: 'Pick set concept' }));
  await screen.findByText('Valid set concept: 3 members found.');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  // Step 3: members default to the whole set; chart only for numeric
  expect(screen.getByText('Creatinine')).toBeInTheDocument();
  expect(screen.getByLabelText('Show in chart', { selector: '#chart-stage-uuid' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  // Step 4: retrieval defaults to bounded history
  expect(screen.getByLabelText('Date window (days)')).toHaveValue(730);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  // Step 5: validation summary and save
  await screen.findByText('Source key is unique and valid');
  await user.click(screen.getByRole('button', { name: 'Save data source' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  const [next, key] = onSave.mock.calls[0];
  expect(key).toBe('renalPanelResults');
  expect(next.dataSources.renalPanelResults).toEqual(
    expect.objectContaining({
      type: 'observation-set',
      conceptAlias: 'renalPanelResults.set',
      resultType: 'TABLE',
      maxResults: 50,
      windowDays: 730,
      members: ['crea-uuid', 'stage-uuid', 'notes-uuid'],
    }),
  );
  expect(next.terminology.concepts['renalPanelResults.set']).toBe('1eb05918-f50c-4cad-a827-3c78f296a10a');
});

it('offers the grouped-observations category in the general builder', async () => {
  const user = userEvent.setup();
  render(<DataSourceBuilder definition={definition} onSave={vi.fn()} />);
  await user.selectOptions(screen.getByLabelText('Source category'), 'Grouped Observations (Lab/Concept Set)');
  expect(screen.getByLabelText('Data source key')).toBeInTheDocument();
  expect(screen.getByText('1. Basic information')).toBeInTheDocument();
});

it('shows set qualification as membership-based, not datatype-based', async () => {
  const { ConceptSetHint } = await import('./data-source-set-shared.component');
  const { rerender } = render(
    <ConceptSetHint
      concept={{ uuid: 'flat', display: 'Flat Concept', datatype: { display: 'N/A' }, set: false, setMembers: [], names: [] }}
    />,
  );
  // an N/A concept without membership is rejected despite the class
  expect(screen.getByText(/not a valid set/i)).toBeInTheDocument();
  rerender(
    <ConceptSetHint
      concept={{
        uuid: 'set',
        display: 'Assessment Set',
        datatype: { display: 'N/A' },
        conceptClass: { display: 'LabSet' },
        set: true,
        setMembers: [{ uuid: 'm', display: 'Member', datatype: { display: 'Numeric' } }],
        names: [],
      }}
    />,
  );
  expect(screen.getByText(/Valid set concept: 1 members found/i)).toBeInTheDocument();
});

it('hands an N/A valid set selection from the ordinary builder to the grouped flow', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  const { DataSourceBuilder } = await import('./data-source-builder.component');
  render(
    <FreshCache>
      <DataSourceBuilder definition={definition} onSave={onSave} />
    </FreshCache>,
  );
  // the ordinary observation builder must not reject an N/A concept that is a set
  await user.click(screen.getByRole('button', { name: 'Pick set concept' }));
  expect(
    await screen.findByText('Valid concept set: 3 members found.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/not supported by the registered observation resolver/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Use grouped source' }));
  // hand-off starts at basic information (the key must be authored), concept preselected
  expect(screen.getByText('1. Basic information')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Data source key'), 'viralLoadResults');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByText('Valid set concept: 3 members found.')).toBeInTheDocument();
});

it('builder writes a real concept UUID for the generalPatientNotes alias', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <FreshCache>
      <SetSourceBuilder definition={definition} onSave={onSave} />
    </FreshCache>,
  );
  await user.type(screen.getByLabelText('Data source key'), 'generalPatientNotes');
  await user.type(screen.getByLabelText('Display name'), 'General patient notes');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Pick set concept' }));
  await screen.findByText('Valid set concept: 3 members found.');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Save data source' }));
  expect(onSave).toHaveBeenCalledTimes(1);
  const [next] = onSave.mock.calls[0];
  // the alias maps to the exact concept UUID, never a display name or placeholder
  expect(next.terminology.concepts['generalPatientNotes.set']).toMatch(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  );
});
