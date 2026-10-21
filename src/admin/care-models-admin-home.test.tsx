import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { navigate } from '@openmrs/esm-framework';
import CareModelsAdminHome from './care-models-admin-home.component';
import * as api from '../api/caremodels.resource';

const mutate = vi.fn().mockResolvedValue(undefined);
vi.mock('../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRegistry: vi.fn(),
  usePrivileges: () => ({ data: ['View Test'] }),
  changeModelStatus: vi.fn(),
  fetchEnvelope: vi.fn(),
  duplicateModel: vi.fn(),
  importModel: vi.fn(),
}));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  UserHasAccess: ({ children }) => children,
  PageHeader: ({ children }) => <header>{children}</header>,
  useSession: () => ({ sessionLocation: { display: 'Actual session location' } }),
}));
const model = {
  uuid: 'model',
  code: 'test',
  name: 'Test model',
  privilege: 'View Test',
  status: 'PUBLISHED' as const,
  revision: 3,
  retired: false,
};
function registry(overrides: object = {}) {
  vi.mocked(api.useRegistry).mockReturnValue({ data: [model], mutate, isLoading: false, ...overrides } as never);
}
beforeEach(() => registry());
it('shows the dashboard heading, real session location and native designer links', () => {
  render(<CareModelsAdminHome />);
  expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  expect(screen.getByText('Actual session location')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Test model' }));
  expect(navigate).toHaveBeenCalledWith(
    expect.objectContaining({ to: expect.stringContaining('/care-models-admin/test') }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create New Care Model' }));
  expect(navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({ to: expect.stringContaining('/care-models-admin/new') }),
  );
});
it('debounces server search and clears filtered empty results', async () => {
  render(<CareModelsAdminHome />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
  expect(await screen.findByText('No Care Models match these filters.')).toBeInTheDocument();
  expect(api.useRegistry).toHaveBeenLastCalledWith('missing', undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
  expect(await screen.findByRole('link', { name: 'Test model' })).toBeInTheDocument();
});
it('uses supported status parameters and filters retirement separately', () => {
  render(<CareModelsAdminHome />);
  fireEvent.click(screen.getByRole('combobox', { name: /Filter by/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
  expect(api.useRegistry).toHaveBeenLastCalledWith('', 'INACTIVE');
  expect(screen.getByText('No Care Models match these filters.')).toBeInTheDocument();
});
it.each(['deactivate', 'reactivate'] as const)('confirms %s and refreshes metadata', async (action) => {
  if (action === 'reactivate') registry({ data: [{ ...model, status: 'INACTIVE' }] });
  vi.mocked(api.changeModelStatus).mockResolvedValue({ status: 'INACTIVE' });
  render(<CareModelsAdminHome />);
  fireEvent.click(
    screen.getByRole('button', { name: `${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} Test model` }),
  );
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.changeModelStatus).toHaveBeenCalledWith('test', action));
  await waitFor(() => expect(mutate).toHaveBeenCalled());
});
it('distinguishes an empty registry from failures and supports retry', async () => {
  registry({ data: [], error: new Error('offline') });
  const { rerender } = render(<CareModelsAdminHome />);
  expect(screen.getByText('Could not load Care Models')).toBeInTheDocument();
  expect(screen.queryByText('No Care Models available')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mutate).toHaveBeenCalled();
  registry({ data: [] });
  rerender(<CareModelsAdminHome />);
  expect(screen.getByText('No Care Models available')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create New Care Model' })).toBeInTheDocument();
});
it('paginates complete metadata in groups of ten and resets after filtering', async () => {
  registry({
    data: Array.from({ length: 23 }, (_, i) => ({ ...model, uuid: `m${i}`, code: `code${i}`, name: `Model ${i}` })),
  });
  render(<CareModelsAdminHome />);
  expect(screen.getAllByRole('link')).toHaveLength(10);
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getAllByRole('link')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'code0' } });
  expect(await screen.findByRole('link', { name: 'Model 0' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
});
it('opens import and explains unavailable draft actions', () => {
  registry({ data: [{ ...model, status: 'DRAFT' }] });
  render(<CareModelsAdminHome />);
  expect(
    screen.getByRole('button', { name: 'Duplicate unavailable for unpublished or retired models' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Availability changes require a published, non-retired model' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  expect(screen.getByRole('dialog', { name: 'Import Care Model' })).toBeInTheDocument();
  expect(screen.getByLabelText('Storage envelope JSON')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
});
it('shows loading rather than an empty result', () => {
  registry({ data: undefined, isLoading: true });
  render(<CareModelsAdminHome />);
  expect(screen.getByLabelText('Loading Care Models')).toBeInTheDocument();
  expect(screen.queryByText('No Care Models available')).not.toBeInTheDocument();
});

const envelope = {
  storageSchemaVersion: '1.0.0',
  revision: 1,
  published: {
    version: '1.0.0',
    definition: { schemaVersion: '1.0.0', workspace: { tabs: [{ id: 'overview' }] } },
  },
};
it.each(['Import', 'Duplicate'] as const)('submits %s with a registered viewing privilege', async (action) => {
  render(<CareModelsAdminHome />);
  fireEvent.click(screen.getByRole('button', { name: action === 'Import' ? 'Import' : 'Duplicate Test model' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'copy' } });
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Copy' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Open' }));
  fireEvent.click(screen.getByRole('option', { name: 'View Test' }));
  if (action === 'Import')
    fireEvent.change(within(dialog).getByLabelText('Storage envelope JSON'), {
      target: { value: JSON.stringify(envelope) },
    });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  await waitFor(() =>
    action === 'Import'
      ? expect(api.importModel).toHaveBeenCalledWith('copy', 'Copy', 'View Test', envelope)
      : expect(api.duplicateModel).toHaveBeenCalledWith('test', 'copy', 'Copy', 'View Test'),
  );
});
it('exports the validated storage envelope through the existing operation', async () => {
  vi.mocked(api.fetchEnvelope).mockResolvedValue({ envelope: JSON.stringify(envelope) });
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<CareModelsAdminHome />);
  fireEvent.click(screen.getByRole('button', { name: 'Export Test model' }));
  await waitFor(() => expect(api.fetchEnvelope).toHaveBeenCalledWith('test'));
  await waitFor(() => expect(click).toHaveBeenCalled());
  expect(create).toHaveBeenCalledWith(expect.any(Blob));
  expect(revoke).toHaveBeenCalledWith('blob:export');
  create.mockRestore();
  revoke.mockRestore();
  click.mockRestore();
});

it('shows backend descriptions beneath model links', () => {
  registry({ data: [{ ...model, description: 'Specialized clinical workspace' }] });
  render(<CareModelsAdminHome />);
  expect(screen.getByText('Specialized clinical workspace')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Required viewing privilege' })).toBeInTheDocument();
});
it('keeps creation actions only in the toolbar when the registry is empty', () => {
  registry({ data: [] });
  render(<CareModelsAdminHome />);
  expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Import a definition' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create Care Model' })).not.toBeInTheDocument();
  const toolbar = screen.getByRole('region', { name: 'Registry controls' });
  expect(within(toolbar).getByRole('button', { name: 'Create New Care Model' })).toBeInTheDocument();
  fireEvent.click(within(toolbar).getByRole('button', { name: 'Import' }));
  expect(screen.getByRole('dialog', { name: 'Import Care Model' })).toBeInTheDocument();
});
