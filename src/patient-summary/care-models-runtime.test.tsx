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

it('refreshes externally created enrollments without fetching the admin registry or submitting writes', async () => {
  let enrolled = false;
  fetch.mockImplementation(async (url) => {
    const path = String(url);
    if (path.endsWith('/session'))
      return {
        data: { authenticated: true, user: { uuid: 'user', privileges: [{ name: 'View Care Models' }] } },
      } as never;
    if (path.includes('/membership'))
      return { data: { results: enrolled ? [{ ...membership('new-model'), episodeNumber: 2 }] : [] } } as never;
    return {
      data: {
        results: [
          {
            modelCode: 'new-model',
            modelUuid: 'new-model',
            memberUuid: 'member-new-model',
            tabId: 'overview',
            tabLabel: 'Overview',
            widgets: [],
          },
        ],
      },
    } as never;
  });
  mount();
  expect(await screen.findByText('Active enrollments: 0')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Enroll in a care model' })).toBeDisabled();
  enrolled = true;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh enrollments' }));
  expect(await screen.findByText('Episode 2')).toBeInTheDocument();
  expect(screen.getByText('Active enrollments: 1')).toBeInTheDocument();
  expect(screen.getByText('Enrollment date unavailable')).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([url]) => String(url).includes('/membership'))).toHaveLength(2);
  expect(fetch.mock.calls.some(([url]) => /\/model(?:\?|\/|$)/.test(String(url)))).toBe(false);
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});

it('removes cached model names and clinical content when enrollment refresh is denied', async () => {
  let denied = false;
  fetch.mockImplementation(async (url) => {
    const path = String(url);
    if (path.endsWith('/session'))
      return {
        data: { authenticated: true, user: { uuid: 'user', privileges: [{ name: 'View Care Models' }] } },
      } as never;
    if (path.includes('/membership')) {
      if (denied) throw Object.assign(new Error('Forbidden'), { status: 403 });
      return { data: { results: [membership('restricted-model')] } } as never;
    }
    return {
      data: {
        results: [
          {
            modelCode: 'restricted-model',
            modelUuid: 'restricted-model',
            memberUuid: 'member-restricted-model',
            tabId: 'overview',
            tabLabel: 'Overview',
            widgets: [],
          },
        ],
      },
    } as never;
  });
  mount();
  expect(await screen.findByText('restricted-model')).toBeInTheDocument();
  denied = true;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh enrollments' }));
  expect(await screen.findByText('Could not load Care Models')).toBeInTheDocument();
  expect(screen.queryByText('restricted-model')).not.toBeInTheDocument();
  expect(screen.queryByText('Active enrollments: 1')).not.toBeInTheDocument();
});

it('loads a fresh default workspace when a model receives a new enrollment episode', async () => {
  let episode = 1;
  fetch.mockImplementation(async (url) => {
    const path = String(url);
    if (path.endsWith('/session'))
      return {
        data: { authenticated: true, user: { uuid: 'user', privileges: [{ name: 'View Care Models' }] } },
      } as never;
    if (path.includes('/membership'))
      return {
        data: { results: [{ ...membership('model'), memberUuid: `episode-${episode}`, episodeNumber: episode }] },
      } as never;
    return {
      data: {
        results: [
          {
            modelCode: 'model',
            modelUuid: 'model',
            memberUuid: `episode-${episode}`,
            tabId: 'overview',
            tabLabel: 'Overview',
            widgets: [],
          },
        ],
      },
    } as never;
  });
  mount();
  expect(await screen.findByText('Episode 1')).toBeInTheDocument();
  await screen.findByText('No content in this section.');
  episode = 2;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh enrollments' }));
  expect(await screen.findByText('Episode 2')).toBeInTheDocument();
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes('/workspace'))).toHaveLength(2));
  expect(
    fetch.mock.calls
      .filter(([url]) => String(url).includes('/workspace'))
      .every(([url]) => !String(url).includes('&tab=')),
  ).toBe(true);
});
