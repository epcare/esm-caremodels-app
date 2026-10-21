import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { DeferredWidget, ModelWorkspace } from './inner-tabs.component';
import type { CareModelMembership, WorkspaceTab } from '../types/caremodels';

const fetch = vi.mocked(openmrsFetch);
const model: CareModelMembership = {
  memberUuid: 'member',
  modelUuid: 'model',
  modelCode: 'model-a',
  modelName: 'Model A',
  displayLabel: 'Model A',
  episodeNumber: 1,
};
const tab = (id: string, source: string): WorkspaceTab => ({
  modelCode: 'model-a',
  modelUuid: 'model',
  memberUuid: 'member',
  tabId: id,
  tabLabel: id,
  tabs: [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
  ],
  widgets: [{ id: source, type: 'metric', dataSource: source, loadingPolicy: 'EAGER' }],
});
const cache = (children: React.ReactNode) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

it('requests only the selected model/default tab, then the selected inner tab source', async () => {
  fetch.mockImplementation(async (url, options) => {
    if (String(url).includes('/workspace'))
      return {
        data: {
          results: [
            String(url).includes('tab=history') ? tab('history', 'history-source') : tab('overview', 'overview-source'),
          ],
        },
      } as never;
    const source = JSON.parse(options!.body as string).dataSource;
    return {
      data: {
        resultJson: JSON.stringify({
          type: 'latest-observation',
          values: [{ obsUuid: source, valueType: 'STRING', value: source }],
        }),
      },
    } as never;
  });
  render(cache(<ModelWorkspace patientUuid="patient-a" model={model} />));
  expect(await screen.findByText('overview-source', { selector: 'p.metricValue' })).toBeInTheDocument();
  const dataCalls = () =>
    fetch.mock.calls
      .filter(([url]) => String(url).endsWith('/data'))
      .map(([, options]) => JSON.parse(options!.body as string));
  expect(dataCalls()).toEqual([
    { patient: 'patient-a', model: 'model-a', tab: 'overview', dataSource: 'overview-source' },
  ]);
  fireEvent.click(screen.getByRole('tab', { name: 'History' }));
  expect(await screen.findByText('history-source', { selector: 'p.metricValue' })).toBeInTheDocument();
  expect(dataCalls()).toHaveLength(2);
  expect(dataCalls()[1]).toEqual({
    patient: 'patient-a',
    model: 'model-a',
    tab: 'history',
    dataSource: 'history-source',
  });
});

it('ignores a slow result from a previously selected model', async () => {
  let resolveOld!: (response: unknown) => void;
  fetch.mockImplementation(async (url, options) => {
    if (String(url).includes('/workspace'))
      return { data: { results: [tab('overview', String(url).includes('model=model-b') ? 'new' : 'old')] } } as never;
    const source = JSON.parse(options!.body as string).dataSource;
    if (source === 'old')
      return (await new Promise((resolve) => {
        resolveOld = resolve;
      })) as never;
    return {
      data: {
        resultJson: JSON.stringify({
          type: 'latest-observation',
          values: [{ obsUuid: source, valueType: 'STRING', value: 'New value' }],
        }),
      },
    } as never;
  });
  const { rerender } = render(cache(<ModelWorkspace key="a" patientUuid="patient" model={model} />));
  await waitFor(() => expect(resolveOld).toBeDefined());
  rerender(cache(<ModelWorkspace key="b" patientUuid="patient" model={{ ...model, modelCode: 'model-b' }} />));
  expect(await screen.findByText('New value')).toBeInTheDocument();
  await act(async () =>
    resolveOld({
      data: {
        resultJson: JSON.stringify({
          type: 'latest-observation',
          values: [{ obsUuid: 'old', valueType: 'STRING', value: 'Old value' }],
        }),
      },
    }),
  );
  expect(screen.queryByText('Old value')).not.toBeInTheDocument();
});

it('defers ON_VISIBLE sources until the widget enters the viewport', async () => {
  let reveal!: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        reveal = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  fetch.mockResolvedValue({
    data: { resultJson: JSON.stringify({ type: 'latest-observation', values: [] }) },
  } as never);
  try {
    render(
      cache(
        <DeferredWidget
          widget={{ id: 'deferred', type: 'metric', dataSource: 'source' }}
          patientUuid="p"
          modelCode="m"
          tabId="overview"
        />,
      ),
    );
    expect(observe).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    act(() => reveal([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(disconnect).toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
