import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import CareModelsPatientSummary from './care-models-summary.component';

const fetch = vi.mocked(openmrsFetch);
const membership = (code: string) => ({
  memberUuid: `member-${code}`,
  modelUuid: code,
  modelCode: code,
  modelName: code,
  displayLabel: code,
  episodeNumber: 1,
});
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CareModelsPatientSummary />
    </SWRConfig>,
  );
}
beforeEach(() => window.history.replaceState({}, '', '/openmrs/spa/patient/patient-a/chart/care-models'));

it('does not issue membership, workspace or data requests without the master privilege', async () => {
  fetch.mockResolvedValue({ data: { authenticated: true, user: { uuid: 'user', privileges: [] } } } as never);
  const { container } = mount();
  await waitFor(() => expect(container).toBeEmptyDOMElement());
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toMatch(/\/session$/);
});

it('switches between enrolled models and reacts to patient route changes without registry calls', async () => {
  fetch.mockImplementation(async (url, options) => {
    const path = String(url);
    if (path.endsWith('/session'))
      return {
        data: { authenticated: true, user: { uuid: 'user', privileges: [{ name: 'View Care Models' }] } },
      } as never;
    if (path.includes('/membership'))
      return {
        data: { results: path.includes('patient-b') ? [] : [membership('model-a'), membership('model-b')] },
      } as never;
    if (path.includes('/workspace')) {
      const code = path.includes('model=model-b') ? 'model-b' : 'model-a';
      return {
        data: {
          results: [
            {
              modelCode: code,
              modelUuid: code,
              memberUuid: `member-${code}`,
              tabId: 'overview',
              tabLabel: 'Overview',
              widgets: [{ id: code, type: 'metric', dataSource: `${code}-source`, loadingPolicy: 'EAGER' }],
            },
          ],
        },
      } as never;
    }
    const body = JSON.parse(options!.body as string);
    return {
      data: {
        resultJson: JSON.stringify({
          type: 'latest-observation',
          values: [{ obsUuid: 'obs', valueType: 'STRING', value: `${body.model} result` }],
        }),
      },
    } as never;
  });
  mount();
  expect(await screen.findByText('model-a result')).toBeInTheDocument();
  const calls = () =>
    fetch.mock.calls
      .filter(([url]) => String(url).endsWith('/data'))
      .map(([, options]) => JSON.parse(options!.body as string));
  expect(calls().map((call) => call.model)).toEqual(['model-a']);
  fireEvent.click(screen.getByRole('button', { name: /model-b/ }));
  expect(await screen.findByText('model-b result')).toBeInTheDocument();
  expect(screen.queryByText('model-a result')).not.toBeInTheDocument();
  act(() => {
    window.history.replaceState({}, '', '/openmrs/spa/patient/patient-b/chart/care-models');
    window.dispatchEvent(new Event('single-spa:routing-event'));
  });
  expect(await screen.findByText('This patient is not enrolled in any care model.')).toBeInTheDocument();
  expect(calls().every((call) => call.patient === 'patient-a')).toBe(true);
  expect(fetch.mock.calls.some(([url]) => /\/model(?:\?|\/|$)/.test(String(url)))).toBe(false);
});
