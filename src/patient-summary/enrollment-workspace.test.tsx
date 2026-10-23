import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EnrollmentWorkspace from './enrollment-workspace.component';
import type { ManualEnrollmentOption } from '../types/caremodels';

const mocks = vi.hoisted(() => ({
  fetchManualEnrollmentOptions: vi.fn(),
  fetchEnrollmentCheck: vi.fn(),
  enrollInCareModel: vi.fn(),
  launchWorkspace2: vi.fn(),
  showSnackbar: vi.fn(),
  usePatient: vi.fn(),
}));

vi.mock('../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchManualEnrollmentOptions: mocks.fetchManualEnrollmentOptions,
  fetchEnrollmentCheck: mocks.fetchEnrollmentCheck,
  enrollInCareModel: mocks.enrollInCareModel,
}));

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  launchWorkspace2: mocks.launchWorkspace2,
  showSnackbar: mocks.showSnackbar,
  usePatient: mocks.usePatient,
  // Render workspace content directly; the real component provides the shell.
  Workspace2: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const option = (overrides: Partial<ManualEnrollmentOption> = {}): ManualEnrollmentOption => ({
  modelUuid: 'model-uuid',
  modelCode: 'hiv',
  displayLabel: 'HIV Care and Treatment',
  category: 'CHRONIC_CARE',
  requiresReason: false,
  requiresConfirmation: false,
  alreadyEnrolled: false,
  openStatus: null,
  eligible: true,
  reason: null,
  ...overrides,
});

const patient = {
  name: [{ text: 'Nakato Jane' }],
  gender: 'female',
  identifier: [{ value: '1000A7' }],
};

function renderWorkspace() {
  const closeWorkspace = vi.fn();
  const promptBeforeClosing = vi.fn();
  render(
    <EnrollmentWorkspace
      closeWorkspace={closeWorkspace}
      promptBeforeClosing={promptBeforeClosing}
      workspaceProps={{ patientUuid: `patient-${Math.random().toString(36).slice(2, 8)}` }}
    />,
  );
  return { closeWorkspace, promptBeforeClosing };
}

const eligibleCheck = {
  modelCode: 'hiv',
  status: 'ELIGIBLE' as const,
  canEnroll: true,
  requiresReason: true,
  requiresConfirmation: false,
  reasons: [],
};

beforeEach(() => {
  mocks.usePatient.mockReturnValue({ patient });
});

it('shows patient context and the authorized model list with availability indicators', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([
    option(),
    option({ modelCode: 'ncd', displayLabel: 'NCD Care', alreadyEnrolled: true, openStatus: 'ACTIVE', eligible: false }),
  ]);
  renderWorkspace();
  expect(await screen.findByText('Nakato Jane')).toBeInTheDocument();
  expect(await screen.findByText('HIV Care and Treatment')).toBeInTheDocument();
  expect(screen.getByText('Already enrolled')).toBeInTheDocument();
});

it('runs the eligibility check only after deliberate selection and gates submission', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([option({ requiresReason: true })]);
  mocks.fetchEnrollmentCheck.mockResolvedValue(eligibleCheck);
  mocks.enrollInCareModel.mockResolvedValue({ status: 'ACTIVE' });
  const { closeWorkspace } = renderWorkspace();

  expect(screen.queryByText('Enrollment details')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByText('HIV Care and Treatment'));
  await waitFor(() => expect(mocks.fetchEnrollmentCheck).toHaveBeenCalledWith(expect.any(String), 'hiv'));
  expect(await screen.findByText('Eligible')).toBeInTheDocument();

  const enroll = screen.getByRole('button', { name: 'Enroll patient' });
  expect(enroll).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Enrollment reason (required)'), { target: { value: 'Chronic care' } });
  await waitFor(() => expect(enroll).toBeEnabled());
  fireEvent.click(enroll);
  await waitFor(() =>
    expect(mocks.enrollInCareModel).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'manual', model: 'hiv', reason: 'Chronic care' }),
    ),
  );
  await waitFor(() => expect(closeWorkspace).toHaveBeenCalled());
  expect(mocks.showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
});

it('marks already-enrolled models ineligible through the backend check', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([
    option({ alreadyEnrolled: true, openStatus: 'ACTIVE', eligible: false }),
  ]);
  mocks.fetchEnrollmentCheck.mockResolvedValue({
    modelCode: 'hiv',
    status: 'ALREADY_ENROLLED',
    canEnroll: false,
    requiresReason: false,
    requiresConfirmation: false,
    reasons: ['Patient already has an open episode in this Care Model'],
  });
  renderWorkspace();
  fireEvent.click(await screen.findByText('HIV Care and Treatment'));
  expect(await screen.findByText('Already enrolled')).toBeInTheDocument();
  await screen.findByText(/open episode/);
  expect(screen.getByRole('button', { name: 'Enroll patient' })).toBeDisabled();
});

it('requires the confirmation checkbox when the model policy demands it', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([option({ requiresConfirmation: true })]);
  mocks.fetchEnrollmentCheck.mockResolvedValue({ ...eligibleCheck, requiresConfirmation: true });
  renderWorkspace();
  fireEvent.click(await screen.findByText('HIV Care and Treatment'));
  const enroll = await screen.findByRole('button', { name: 'Enroll patient' });
  await waitFor(() => expect(enroll).toBeDisabled());
  fireEvent.click(screen.getByLabelText('I confirm this enrollment with the patient'));
  await waitFor(() => expect(enroll).toBeEnabled());
});

it('flags unsaved reasons through the workspace dirty-state hook and supports discard', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([option({ requiresReason: true })]);
  mocks.fetchEnrollmentCheck.mockResolvedValue(eligibleCheck);
  const { closeWorkspace, promptBeforeClosing } = renderWorkspace();
  fireEvent.click(await screen.findByText('HIV Care and Treatment'));
  fireEvent.change(await screen.findByLabelText('Enrollment reason (required)'), { target: { value: 'Draft reason' } });
  await waitFor(() => expect(promptBeforeClosing).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect(closeWorkspace).toHaveBeenCalled();
});
