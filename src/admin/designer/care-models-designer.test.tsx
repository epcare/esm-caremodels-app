import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { navigate } from '@openmrs/esm-framework';
import { ModelEditor } from './care-models-designer.component';
import * as api from '../../api/caremodels.resource';
import { blankDefinition } from './definition';

vi.mock('../../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/caremodels.resource')>()),
  fetchEnvelope: vi.fn(),
  fetchModel: vi.fn(),
  createModel: vi.fn(),
  saveDraft: vi.fn(),
  updateModelMetadata: vi.fn(),
  publishModel: vi.fn(),
  validateDefinition: vi.fn(),
  usePrivileges: () => ({ data: ['View Test'], isLoading: false }),
}));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  UserHasAccess: ({ children }) => children,
}));

beforeEach(() => {
  const definition = blankDefinition();
  definition.metadata.display.label = 'Test';
  definition.workspace.tabs.push({ id: 'history', label: 'History', widgets: [] });
  vi.mocked(api.fetchEnvelope).mockResolvedValue({
    envelope: JSON.stringify({
      storageSchemaVersion: '1.0.0',
      revision: 4,
      draft: { basedOnVersion: '1.0.0', definition },
    }),
  });
  vi.mocked(api.fetchModel).mockResolvedValue({
    uuid: 'm',
    code: 'test',
    name: 'Test',
    privilege: 'View Test',
    status: 'DRAFT',
    revision: 4,
    retired: false,
  });
  vi.mocked(api.saveDraft).mockResolvedValue({ modelCode: 'test', revision: 5 });
  vi.mocked(api.updateModelMetadata).mockResolvedValue({} as never);
  vi.mocked(api.validateDefinition).mockResolvedValue({ valid: true });
  vi.mocked(api.publishModel).mockResolvedValue({ revision: 6, status: 'PUBLISHED' });
});

it('loads model metadata separately, preserves tabs and publishes the edited draft revision', async () => {
  render(<ModelEditor modelCode="test" />);
  const label = await screen.findByLabelText('Patient display label');
  fireEvent.change(label, { target: { value: 'Edited label' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Publish', exact: true })[0]);
  fireEvent.change(screen.getByLabelText('Release version', { selector: '#publish-version' }), {
    target: { value: '1.2.0' },
  });
  const modal = screen.getByRole('dialog', { name: 'Publish care model' });
  fireEvent.click(within(modal).getByRole('button', { name: 'Publish', exact: true }));
  await waitFor(() => expect(api.publishModel).toHaveBeenCalledWith('test', '1.2.0', 5));
  expect(api.saveDraft).toHaveBeenCalledWith(
    'test',
    expect.objectContaining({
      workspace: expect.objectContaining({
        tabs: expect.arrayContaining([expect.objectContaining({ id: 'history' })]),
      }),
      metadata: expect.objectContaining({ display: expect.objectContaining({ label: 'Edited label' }) }),
    }),
    4,
  );
  expect(api.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(api.publishModel.mock.invocationCallOrder[0]);
});

it('does not publish after a revision conflict and retains local edits', async () => {
  vi.mocked(api.saveDraft).mockResolvedValue({ conflict: true, currentRevision: 8 });
  render(<ModelEditor modelCode="test" />);
  fireEvent.change(await screen.findByLabelText('Patient display label'), { target: { value: 'Local edit' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Publish', exact: true })[0]);
  const modal = screen.getByRole('dialog', { name: 'Publish care model' });
  fireEvent.click(within(modal).getByRole('button', { name: 'Publish', exact: true }));
  await screen.findAllByText(/now at revision 8/);
  expect(api.publishModel).not.toHaveBeenCalled();
  expect(api.updateModelMetadata).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Patient display label')).toHaveValue('Local edit');
});

it('blocks editing when the existing draft fails to load', async () => {
  vi.mocked(api.fetchEnvelope).mockRejectedValue(new Error('denied'));
  render(<ModelEditor modelCode="test" />);
  expect(await screen.findByText('Could not load this care model draft.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
});

// Model state tests use an accessible editor double; Ace lifecycle is tested separately.
vi.mock('./definition-json-editor.component', () => ({
  DefinitionJsonEditor: ({ value, onChange, onDiscard, errors }) => (
    <>
      <textarea aria-label="Definition JSON" value={value} onChange={(event) => onChange(event.target.value)} />
      <button onClick={onDiscard}>Reset to current draft</button>
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </>
  ),
}));
it('opens a clean structured creation workflow with separate metadata', () => {
  render(<ModelEditor modelCode={null} />);
  expect(screen.getByRole('heading', { name: 'Create Care Model' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Configuration sections' })).toBeInTheDocument();
  expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
});
it('synchronizes valid JSON and visual edits, preserving an invalid buffer across modes', async () => {
  render(<ModelEditor modelCode="test" />);
  await screen.findByLabelText('Patient display label');
  fireEvent.click(screen.getByRole('tab', { name: 'JSON Editor' }));
  const original = JSON.parse((screen.getByLabelText('Definition JSON') as HTMLTextAreaElement).value);
  original.metadata.display.label = 'From JSON';
  fireEvent.change(screen.getByLabelText('Definition JSON'), { target: { value: JSON.stringify(original) } });
  fireEvent.click(screen.getByRole('tab', { name: 'Visual Builder' }));
  expect(screen.getByLabelText('Patient display label')).toHaveValue('From JSON');
  fireEvent.change(screen.getByLabelText('Patient display label'), { target: { value: 'From visual' } });
  fireEvent.click(screen.getByRole('tab', { name: 'JSON Editor' }));
  expect((screen.getByLabelText('Definition JSON') as HTMLTextAreaElement).value).toContain('From visual');
  fireEvent.change(screen.getByLabelText('Definition JSON'), { target: { value: '{broken' } });
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Visual Builder' }));
  expect(screen.getByLabelText('Patient display label')).toHaveValue('From visual');
  fireEvent.click(screen.getByRole('tab', { name: 'JSON Editor' }));
  expect(screen.getByLabelText('Definition JSON')).toHaveValue('{broken');
  fireEvent.click(screen.getByRole('button', { name: 'Reset to current draft' }));
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
});
it('persists the canonical document changed through JSON with its expected revision', async () => {
  render(<ModelEditor modelCode="test" />);
  await screen.findByLabelText('Patient display label');
  fireEvent.click(screen.getByRole('tab', { name: 'JSON Editor' }));
  const definition = blankDefinition();
  definition.metadata.display.label = 'JSON save';
  fireEvent.change(screen.getByLabelText('Definition JSON'), { target: { value: JSON.stringify(definition) } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(api.saveDraft).toHaveBeenCalledWith('test', definition, 4));
});
it('keeps backend validation paths visible and blocks publication until corrected', async () => {
  vi.mocked(api.validateDefinition).mockResolvedValue({
    valid: false,
    validationErrors: '$.dataSources.source: Alias missing',
  });
  render(<ModelEditor modelCode="test" />);
  await screen.findByLabelText('Patient display label');
  fireEvent.click(screen.getByRole('button', { name: 'Validate', exact: true }));
  await screen.findByText('$.dataSources.source: Alias missing');
  expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Patient display label'), { target: { value: 'Corrected draft' } });
  expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  vi.mocked(api.validateDefinition).mockResolvedValue({ valid: true });
  fireEvent.click(screen.getByRole('button', { name: 'Validate', exact: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled());
});

it('creates a model through the existing workflow with viewing privilege outside the definition', async () => {
  vi.mocked(api.createModel).mockResolvedValue({ revision: 1, modelCode: 'new-care' });
  render(<ModelEditor modelCode={null} />);
  fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'new-care' } });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New care' } });
  fireEvent.change(screen.getByLabelText('Patient display label'), { target: { value: 'Patient label' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  fireEvent.click(screen.getByRole('option', { name: 'View Test' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(api.createModel).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'new-care',
        name: 'New care',
        privilege: 'View Test',
        definition: expect.objectContaining({
          metadata: expect.objectContaining({ display: expect.objectContaining({ label: 'Patient label' }) }),
        }),
      }),
    ),
  );
  expect(api.createModel.mock.calls[0][0].definition).not.toHaveProperty('privilege');
  expect(navigate).toHaveBeenCalledWith(
    expect.objectContaining({ to: expect.stringContaining('/care-models-admin/new-care'), replace: true }),
  );
});
it('opens the published configuration when no draft is stored', async () => {
  const definition = blankDefinition();
  definition.metadata.display.label = 'Published label';
  vi.mocked(api.fetchEnvelope).mockResolvedValue({
    envelope: JSON.stringify({
      storageSchemaVersion: '1.0.0',
      revision: 7,
      published: { version: '2.0.0', definition },
    }),
  });
  render(<ModelEditor modelCode="test" />);
  expect(await screen.findByLabelText('Patient display label')).toHaveValue('Published label');
  expect(screen.getByText('Revision 7')).toBeInTheDocument();
  expect(screen.getByLabelText('Release version')).toHaveValue('2.0.1');
});

it('blocks incompatible widget bindings before backend validation or publication', async () => {
  const definition = blankDefinition();
  definition.metadata.display.label = 'Test';
  definition.dataSources.source = {
    type: 'latest-observation',
    conceptAlias: 'state',
    resultType: 'CODED',
    maxResults: 20,
  };
  definition.terminology.concepts = { state: 'real-concept-uuid' };
  definition.workspace.tabs[0].widgets = [{ id: 'trend', type: 'trend-chart', dataSource: 'source' }];
  vi.mocked(api.fetchEnvelope).mockResolvedValue({
    envelope: JSON.stringify({ storageSchemaVersion: '1.0.0', revision: 4, draft: { definition } }),
  });
  render(<ModelEditor modelCode="test" />);
  await screen.findByLabelText('Patient display label');
  fireEvent.click(screen.getByRole('button', { name: 'Validate', exact: true }));
  await screen.findByText(/workspace.tabs\[0\].widgets\[0\].dataSource/);
  expect(api.validateDefinition).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
});
