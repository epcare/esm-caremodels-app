import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EnrollmentModal } from './enrollment-modal.component';
import type { ManualEnrollmentOption } from '../types/caremodels';

const mocks = vi.hoisted(() => ({
  fetchManualEnrollmentOptions: vi.fn(),
  enrollInCareModel: vi.fn(),
}));

vi.mock('../api/caremodels.resource', async (original) => ({
  ...(await original<object>()),
  fetchManualEnrollmentOptions: mocks.fetchManualEnrollmentOptions,
  enrollInCareModel: mocks.enrollInCareModel,
}));

const option = (overrides: Partial<ManualEnrollmentOption> = {}): ManualEnrollmentOption => ({
  modelUuid: 'model-uuid',
  modelCode: 'hiv',
  displayLabel: 'HIV Care and Treatment',
  category: 'CHRONIC_CARE',
  requiresReason: false,
  alreadyEnrolled: false,
  openStatus: null,
  eligible: true,
  reason: null,
  ...overrides,
});

let patientSequence = 0;
function renderModal(props: Partial<{ onEnrolled: (code: string) => void; onClose: () => void }> = {}) {
  const onEnrolled = vi.fn();
  const onClose = vi.fn();
  // Distinct patient per test: the SWR cache is global and would leak options across tests.
  const patientUuid = `patient-${++patientSequence}`;
  render(<EnrollmentModal patientUuid={patientUuid} onEnrolled={onEnrolled} onClose={onClose} {...props} />);
  return { onEnrolled, onClose, patientUuid };
}

it('lists authorized options with eligibility and already-enrolled indicators', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([
    option(),
    option({ modelCode: 'tb', displayLabel: 'TB Care', category: 'RESPIRATORY' }),
    option({ modelCode: 'anc', displayLabel: 'ANC', category: 'MATERNAL', eligible: false, reason: 'Reenrollment is disabled' }),
    option({ modelCode: 'ncd', displayLabel: 'NCD', alreadyEnrolled: true, openStatus: 'ACTIVE', eligible: false }),
  ]);
  renderModal();
  expect(await screen.findByText('HIV Care and Treatment')).toBeInTheDocument();
  expect(screen.getAllByText('Eligible')).toHaveLength(2);
  expect(screen.getByText('Already enrolled')).toBeInTheDocument();
  expect(screen.getByText(/Reenrollment is disabled/)).toBeInTheDocument();
  // Category filter narrows the list to matching categories only.
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'CHRONIC_CARE' } });
  expect(screen.getByText('HIV Care and Treatment')).toBeInTheDocument();
  expect(screen.queryByText('TB Care')).not.toBeInTheDocument();
  expect(screen.queryByText('ANC')).not.toBeInTheDocument();
});

it('search filters by name or code across categories', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([
    option({ category: null }),
    option({ modelCode: 'tb', displayLabel: 'TB Care', category: null }),
  ]);
  renderModal();
  await screen.findByText('HIV Care and Treatment');
  fireEvent.change(screen.getByPlaceholderText('Search by name or code'), { target: { value: 'tb' } });
  expect(screen.queryByText('HIV Care and Treatment')).not.toBeInTheDocument();
  expect(screen.getByText('TB Care')).toBeInTheDocument();
});

it('gates confirmation on a mandatory reason and submits the enrollment', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([option({ requiresReason: true })]);
  mocks.enrollInCareModel.mockResolvedValue({ status: 'ACTIVE' });
  const { onEnrolled } = renderModal();
  const confirm = await screen.findByRole('button', { name: 'Confirm enrollment' });
  fireEvent.click(await screen.findByText('HIV Care and Treatment'));
  await waitFor(() => expect(confirm).toBeDisabled());
  fireEvent.change(screen.getByLabelText('Enrollment reason (required)'), {
    target: { value: 'Clinician decision after review' },
  });
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(mocks.enrollInCareModel).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'manual', model: 'hiv', reason: 'Clinician decision after review' }),
    ),
  );
  await waitFor(() => expect(onEnrolled).toHaveBeenCalledWith('hiv'));
});

it('preserves the entered reason and shows an actionable error when enrollment fails', async () => {
  mocks.fetchManualEnrollmentOptions.mockResolvedValue([option({ requiresReason: true })]);
  mocks.enrollInCareModel.mockRejectedValue({
    response: { data: { error: { message: 'Reenrollment is disabled or its cooldown has not elapsed' } } },
  });
  renderModal();
  fireEvent.click(await screen.findByText('HIV Care and Treatment'));
  fireEvent.change(screen.getByLabelText('Enrollment reason (required)'), { target: { value: 'Clinician decision' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm enrollment' }));
  await screen.findByText('Enrollment was not applied');
  expect(await screen.findByText(/cooldown has not elapsed/)).toBeInTheDocument();
  expect((screen.getByLabelText('Enrollment reason (required)') as HTMLTextAreaElement).value).toBe(
    'Clinician decision',
  );
});
