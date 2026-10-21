import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ModelEditor } from './care-models-designer.component';
import * as api from '../../api/caremodels.resource';
import { blankDefinition } from './definition';

vi.mock('../../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/caremodels.resource')>()),
  fetchEnvelope: vi.fn(),
  fetchModel: vi.fn(),
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
