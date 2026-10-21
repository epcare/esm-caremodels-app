import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CareModelsPatientSummary from './care-models-summary.component';
import { hasMasterPrivilege } from '../api/caremodels.resource';
import {
  mockMemberships,
  mockSessionWithMasterPrivilege,
  mockSessionWithoutMasterPrivilege,
} from '../../__mocks__/caremodels.mock';

const useSession = vi.fn();
const useMemberships = vi.fn();

vi.mock(import('../api/caremodels.resource'), async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/caremodels.resource')>();
  return {
    ...actual,
    useSession: (...args) => useSession(...args),
    useMemberships: (...args) => useMemberships(...args),
  };
});
vi.mocked(hasMasterPrivilege);

function renderSummary() {
  return render(<CareModelsPatientSummary />);
}

describe('CareModelsPatientSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/openmrs/spa/patient/11111111-2222-3333-4444-555555555555/chart' },
    });
  });

  it('renders nothing and issues no membership request without the master privilege', async () => {
    useSession.mockReturnValue({ data: mockSessionWithoutMasterPrivilege, isLoading: false });
    useMemberships.mockReturnValue({ data: undefined, isLoading: false, error: undefined });

    const { container } = renderSummary();

    await waitFor(() => expect(useSession).toHaveBeenCalled());
    expect(useMemberships).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders outer tabs only from the authorized membership response', async () => {
    useSession.mockReturnValue({ data: mockSessionWithMasterPrivilege, isLoading: false });
    useMemberships.mockReturnValue({ data: mockMemberships, isLoading: false, error: undefined });

    renderSummary();

    await waitFor(() => expect(useMemberships).toHaveBeenCalledWith('11111111-2222-3333-4444-555555555555', true));
    expect(await screen.findByText('HIV Care')).toBeInTheDocument();
  });

  it('shows the empty state when the patient has no active membership', async () => {
    useSession.mockReturnValue({ data: mockSessionWithMasterPrivilege, isLoading: false });
    useMemberships.mockReturnValue({ data: [], isLoading: false, error: undefined });

    renderSummary();

    expect(await screen.findByText('This patient is not enrolled in any care model.')).toBeInTheDocument();
  });

  it('shows an error state without disclosing restricted model names', async () => {
    useSession.mockReturnValue({ data: mockSessionWithMasterPrivilege, isLoading: false });
    useMemberships.mockReturnValue({ data: undefined, isLoading: false, error: new Error('denied') });

    renderSummary();

    expect(await screen.findByText('Could not load Care Models')).toBeInTheDocument();
    expect(screen.queryByText('HIV Care')).not.toBeInTheDocument();
  });
});
