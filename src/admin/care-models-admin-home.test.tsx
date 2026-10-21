import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import CareModelsAdminHome from './care-models-admin-home.component';
import * as api from '../api/caremodels.resource';
import { blankDefinition } from './designer/definition';

const mutate = vi.fn();
vi.mock('../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRegistry: vi.fn(),
  usePrivileges: () => ({ data: ['View Test'] }),
  changeModelStatus: vi.fn(),
  fetchEnvelope: vi.fn(),
  publishModel: vi.fn(),
}));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  UserHasAccess: ({ children }) => children,
}));

beforeEach(() => {
  vi.mocked(api.useRegistry).mockReturnValue({
    data: [
      {
        uuid: 'model',
        code: 'test',
        name: 'Test model',
        privilege: 'View Test',
        status: 'PUBLISHED',
        revision: 3,
        retired: false,
      },
    ],
    mutate,
    isLoading: false,
  } as never);
});
it('searches registry metadata and clears the search', () => {
  render(<CareModelsAdminHome />);
  expect(screen.getByText('Test model')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
  expect(screen.getByText('No care models match these filters.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
  expect(screen.getByText('Test model')).toBeInTheDocument();
});
it('deactivates through the declared modeloperation contract and refreshes metadata', async () => {
  vi.mocked(api.changeModelStatus).mockResolvedValue({ status: 'INACTIVE' });
  render(<CareModelsAdminHome />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions: Test model' }));
  fireEvent.click(screen.getByText('Deactivate'));
  const dialog = screen.getByRole('dialog', { name: 'deactivate' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.changeModelStatus).toHaveBeenCalledWith('test', 'deactivate'));
  await waitFor(() => expect(mutate).toHaveBeenCalled());
});
it('does not publish a nonexistent draft', async () => {
  vi.mocked(api.fetchEnvelope).mockResolvedValue({
    envelope: JSON.stringify({
      storageSchemaVersion: '1.0.0',
      revision: 3,
      published: { version: '1.0.0', definition: blankDefinition() },
    }),
  });
  render(<CareModelsAdminHome />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions: Test model' }));
  fireEvent.click(screen.getByText('Publish'));
  const dialog = screen.getByRole('dialog', { name: 'publish' });
  fireEvent.change(screen.getByLabelText('Release version'), { target: { value: '1.1.0' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  await screen.findAllByText('There is no draft to publish.');
  expect(api.publishModel).not.toHaveBeenCalled();
});
