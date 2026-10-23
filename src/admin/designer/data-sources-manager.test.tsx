import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DataSourcesManager,
  findAliasReferences,
  findWidgetUsage,
  sourceCategory,
  sourceResource,
} from './data-sources-manager.component';
import { blankDefinition } from './definition';
import type { ModelDefinition } from '../../types/caremodels';
import type { OpenmrsChoice } from '../../api/caremodels.resource';

vi.mock('../../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchOpenmrsResource: vi.fn(async (_resource: string, uuid: string) => ({ uuid, display: 'ART start date' })),
  fetchConceptDetails: vi.fn(async (uuid: string) => ({
    uuid,
    display: 'Viral load',
    datatype: { uuid: 'dt', display: 'Numeric' },
  })),
}));

vi.mock('../concept-selector.component', () => ({
  ConceptSelector: ({ onSelect }: { onSelect: (choice: OpenmrsChoice) => void }) => (
    <button
      onClick={() =>
        onSelect({
          uuid: 'resolved-concept-uuid',
          display: 'Viral load',
          datatype: { display: 'Numeric' },
          units: 'copies/ml',
        })
      }>
      Pick concept
    </button>
  ),
}));

const baseDefinition = (): ModelDefinition => ({
  ...blankDefinition(),
  terminology: {
    concepts: { 'hiv.viralLoad': 'vl-concept-uuid' },
    encounterTypes: { 'hiv.artClinical': 'enc-uuid' },
    forms: { 'hiv.feedbackForm': 'form-uuid' },
  },
  dataSources: {
    latestViralLoad: {
      type: 'latest-observation',
      conceptAlias: 'hiv.viralLoad',
      resultType: 'NUMBER',
      maxResults: 1,
      windowDays: 365,
      includeVoided: false,
    },
    viralLoadHistory: {
      type: 'historical-observations',
      conceptAlias: 'hiv.viralLoad',
      resultType: 'NUMBER',
      maxResults: 50,
      windowDays: 730,
      includeVoided: false,
    },
    recentVisits: {
      type: 'encounter-query',
      encounterTypeAlias: 'hiv.artClinical',
      resultType: 'TABLE',
      maxResults: 50,
      includeVoided: false,
    },
    visitFeedback: {
      type: 'encounter-query',
      formAlias: 'hiv.feedbackForm',
      resultType: 'TABLE',
      maxResults: 10,
      includeVoided: false,
    },
  },
  workspace: {
    tabs: [
      {
        id: 'overview',
        label: 'Overview',
        widgets: [
          { id: 'metric', type: 'metric', dataSource: 'latestViralLoad', properties: { title: 'Latest viral load' } },
          { id: 'chart', type: 'trend-chart', dataSources: ['latestViralLoad', 'viralLoadHistory'] },
        ],
      },
    ],
  },
});

/** Holds the definition in state like the designer shell, so committed edits re-render the manager. */
function Harness({ initial }: { initial: ModelDefinition }) {
  const [definition, setDefinition] = useState(initial);
  return <DataSourcesManager definition={definition} onChange={setDefinition} />;
}

function renderManager(definition: ModelDefinition = baseDefinition()) {
  render(<Harness initial={definition} />);
}

function inspector() {
  return screen.getByRole('complementary', { name: 'Data source inspector' });
}

it('lists every declared source with type, referenced resource and real usage counts', () => {
  renderManager();
  expect(screen.getByText('latestViralLoad')).toBeInTheDocument();
  expect(screen.getByText('viralLoadHistory')).toBeInTheDocument();
  expect(screen.getByText('recentVisits')).toBeInTheDocument();
  expect(screen.getByText('Concept (latest observation)')).toBeInTheDocument();
  expect(screen.getAllByText('Encounter query')).toHaveLength(2);
  expect(screen.getAllByText('hiv.viralLoad')).toHaveLength(2);
  expect(screen.getByText('2 widgets')).toBeInTheDocument();
  expect(screen.getAllByText('Unused')).toHaveLength(2);
});

it('filters by category and searches key, alias and resolved UUID', () => {
  renderManager();
  fireEvent.click(screen.getByText('Encounter types (1)'));
  expect(screen.getByText('recentVisits')).toBeInTheDocument();
  expect(screen.queryByText('latestViralLoad')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Forms (1)'));
  expect(screen.getByText('visitFeedback')).toBeInTheDocument();
  expect(screen.queryByText('recentVisits')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('All (4)'));
  fireEvent.change(screen.getByPlaceholderText('Search by key, alias or UUID'), { target: { value: 'vl-concept' } });
  expect(screen.getByText('latestViralLoad')).toBeInTheDocument();
  expect(screen.queryByText('recentVisits')).not.toBeInTheDocument();
});

it('reveals read-only details and usage without mutating the definition', async () => {
  renderManager();
  fireEvent.click(screen.getByRole('button', { name: 'latestViralLoad' }));
  const details = await screen.findByRole('complementary', { name: 'Data source inspector' });
  expect(await within(details).findByText('ART start date')).toBeInTheDocument();
  expect(within(details).getAllByText('vl-concept-uuid').length).toBeGreaterThan(0);
  expect(within(details).getAllByText('Latest viral load').length).toBeGreaterThan(0);
  expect(within(details).getAllByText('Workspace → Overview').length).toBeGreaterThan(0);
});

it('edits a source on a draft and only commits on Save Changes', () => {
  const definition = baseDefinition();
  definition.workspace.tabs[0].widgets = [
    { id: 'metric', type: 'metric', dataSource: 'latestViralLoad', properties: { title: 'Latest viral load' } },
  ];
  renderManager(definition);
  fireEvent.click(screen.getByRole('button', { name: 'latestViralLoad' }));
  fireEvent.click(within(inspector()).getByRole('button', { name: 'Edit' }));
  fireEvent.change(within(inspector()).getByLabelText('Units'), { target: { value: 'copies/ml' } });
  fireEvent.click(within(inspector()).getByRole('button', { name: 'Save changes' }));
  expect(within(inspector()).getAllByText('Concept (latest observation)').length).toBeGreaterThan(0);
  expect(within(inspector()).getByText('copies/ml')).toBeInTheDocument();
});

it('cancel discards the edit draft without touching the definition', () => {
  const definition = baseDefinition();
  definition.workspace.tabs[0].widgets = [
    { id: 'metric', type: 'metric', dataSource: 'latestViralLoad', properties: { title: 'Latest viral load' } },
  ];
  renderManager(definition);
  fireEvent.click(screen.getByRole('button', { name: 'latestViralLoad' }));
  fireEvent.click(within(inspector()).getByRole('button', { name: 'Edit' }));
  fireEvent.change(within(inspector()).getByLabelText('Units'), { target: { value: 'copies/ml' } });
  fireEvent.click(within(inspector()).getByRole('button', { name: 'Cancel' }));
  expect(within(inspector()).getAllByText('latestViralLoad').length).toBeGreaterThan(0);
  // Units reverted in the details view after discarding the draft.
  expect(within(inspector()).queryByText('copies/ml')).not.toBeInTheDocument();
});

it('blocks deletion of used sources and removes unused sources after confirmation', () => {
  const definition = baseDefinition();
  renderManager(definition);
  fireEvent.click(screen.getByRole('button', { name: 'latestViralLoad' }));
  expect(within(inspector()).getByRole('button', { name: /Delete/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'recentVisits' }));
  const deleteButton = within(inspector()).getByRole('button', { name: /Delete/i });
  expect(deleteButton).toBeEnabled();
  fireEvent.click(deleteButton);
  fireEvent.click(screen.getByRole('button', { name: /Delete data source/ }));
  expect(screen.queryByRole('button', { name: 'recentVisits' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'latestViralLoad' })).toBeInTheDocument();
});

it('creates a source through the guided builder in a modal with an exact concept UUID', async () => {
  renderManager();
  const registry = screen.getByRole('region', { name: 'Data source registry' });
  fireEvent.click(within(registry).getByRole('button', { name: 'Create data source' }));
  const dialog = await waitFor(() => {
    const open = screen.getAllByRole('dialog').find((el) => within(el).queryByLabelText('Data source key'));
    expect(open).toBeDefined();
    return open!;
  });
  fireEvent.change(within(dialog).getByLabelText('Data source key'), { target: { value: 'newSource' } });
  expect(within(dialog).getByText('Result type')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Pick concept' }));
  expect(within(dialog).getByText('NUMBER', { selector: 'span,div' })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create data source', exact: true }));
  const details = await screen.findByRole('complementary', { name: 'Data source inspector' });
  await waitFor(() => expect(within(details).getByText('Source key')).toBeInTheDocument());
  expect(within(details).getAllByText('newSource').length).toBeGreaterThan(0);
  expect(within(details).getByText('resolved-concept-uuid')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'newSource' })).toBeInTheDocument();
});

it('keeps rule alias references informational while widget bindings block deletion', () => {
  const definition = baseDefinition();
  definition.enrollment = {
    enabled: true,
    rules: [
      {
        id: 'vl-rule',
        action: 'PROPOSE_CONFIRMATION',
        expression: { type: 'observation', operator: 'within', alias: 'hiv.viralLoad', windowDays: 90 },
      },
    ],
  };
  expect(findWidgetUsage(definition, 'latestViralLoad')).toHaveLength(2);
  expect(findWidgetUsage(definition, 'recentVisits')).toHaveLength(0);
  expect(findAliasReferences(definition, 'hiv.viralLoad')).toEqual([
    { kind: 'rule', id: 'observation', name: 'vl-rule', location: 'Enrollment Rules' },
  ]);
  expect(sourceResource(definition.dataSources.latestViralLoad)).toEqual({
    bucket: 'concepts',
    alias: 'hiv.viralLoad',
  });
  expect(sourceCategory(definition.dataSources.recentVisits)).toBe('encounterTypes');
});
