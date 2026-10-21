import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WidgetRenderer } from './widget-renderer.component';
import { chartPoints } from './trend-chart.component';
import { useWidgetData } from '../api/caremodels.resource';

const charts = vi.hoisted(() => ({ line: vi.fn(), bar: vi.fn(), destroy: vi.fn() }));
vi.mock('@carbon/charts', () => ({
  LineChart: class {
    constructor(holder, options) {
      charts.line(holder, options);
    }
    destroy = charts.destroy;
  },
  SimpleBarChart: class {
    constructor(holder, options) {
      charts.bar(holder, options);
    }
    destroy = charts.destroy;
  },
  ScaleTypes: { TIME: 'time', LINEAR: 'linear' },
}));
vi.mock('../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useWidgetData: vi.fn(),
}));
const props = { patientUuid: 'patient', modelCode: 'model', tabId: 'overview' };

it.each([
  ['metric', 'No measurement recorded'],
  ['clinical-table', 'No records'],
  ['timeline', 'No events recorded'],
  ['trend-chart', 'No dated numeric measurements recorded'],
])('shows an empty state for %s without inventing clinical data', (type, text) => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: { type: 'latest-observation', values: [] },
    isLoading: false,
  } as never);
  render(<WidgetRenderer {...props} widget={{ id: 'widget', type: type as never, dataSource: 'source' }} />);
  expect(screen.getByText(text)).toBeInTheDocument();
});

it('keeps unsupported form and action execution disabled', () => {
  render(
    <>
      <WidgetRenderer {...props} widget={{ id: 'form', type: 'form-launcher', formAlias: 'followup' }} />
      <WidgetRenderer {...props} widget={{ id: 'actions', type: 'action-panel', actionIds: ['complete'] }} />
    </>,
  );
  expect(screen.getByRole('button', { name: 'Open form' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'complete' })).toBeDisabled();
});

it('shows configuration and data failures without rendering stale clinical values', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: { type: 'latest-observation', values: [{ obsUuid: 'obs', valueType: 'STRING', value: 'stale value' }] },
    error: new Error('denied'),
    isLoading: false,
  } as never);
  render(
    <>
      <WidgetRenderer {...props} widget={{ id: 'unbound', type: 'metric' }} />
      <WidgetRenderer {...props} widget={{ id: 'bound', type: 'metric', dataSource: 'source' }} />
    </>,
  );
  expect(screen.getByText('This widget has no configured data source.')).toBeInTheDocument();
  expect(screen.getByText('Data unavailable')).toBeInTheDocument();
  expect(screen.queryByText('stale value')).not.toBeInTheDocument();
});

it('plots only dated numeric observations and destroys charts when a widget unmounts', async () => {
  const data = {
    type: 'latest-observation',
    values: [
      { obsUuid: 'late', valueType: 'NUMBER' as const, value: 12, effectiveTime: '2026-10-20T00:00:00Z' },
      { obsUuid: 'early', valueType: 'NUMBER' as const, value: 8, effectiveTime: '2026-10-19T00:00:00Z' },
      { obsUuid: 'invalid', valueType: 'NUMBER' as const, value: 20, effectiveTime: 'invalid' },
      { obsUuid: 'coded', valueType: 'CODED' as const, value: 'uuid' },
    ],
  };
  expect(chartPoints(data).map((p) => p.obsUuid)).toEqual(['early', 'late']);
  vi.mocked(useWidgetData).mockReturnValue({ data, isLoading: false } as never);
  const { unmount } = render(
    <WidgetRenderer
      {...props}
      widget={{
        id: 'trend',
        type: 'trend-chart',
        dataSource: 'source',
        properties: { chartType: 'bar', showDataTable: true },
      }}
    />,
  );
  await waitFor(() => expect(charts.bar).toHaveBeenCalledTimes(1));
  expect(charts.bar.mock.calls[0][1].data).toHaveLength(2);
  expect(screen.getByText('12')).toBeInTheDocument();
  unmount();
  expect(charts.destroy).toHaveBeenCalledTimes(1);
});

it('renders shared metric units, precision, target status and observation date from real result fields', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: {
      type: 'latest-observation',
      values: [{ obsUuid: 'obs', valueType: 'NUMBER', value: 7.24, effectiveTime: '2026-02-01' }],
    },
    isLoading: false,
  } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{
        id: 'metric',
        type: 'metric',
        dataSource: 'source',
        properties: { title: 'Result', unit: '%', decimals: 1, showStatus: true, targetMax: 6 },
      }}
    />,
  );
  expect(screen.getByText('7.2')).toBeInTheDocument();
  expect(screen.getByText('%')).toBeInTheDocument();
  expect(screen.getByText('Outside target')).toBeInTheDocument();
  expect(screen.getByText('Recorded 2026-02-01')).toBeInTheDocument();
});
it('renders clinical status using the metric contract and actual coded label', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: {
      type: 'latest-observation',
      values: [{ obsUuid: 'obs', valueType: 'CODED', value: 'real-answer-uuid', valueName: 'Enrolled' }],
    },
    isLoading: false,
  } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{ id: 'status', type: 'metric', dataSource: 'source', properties: { presentation: 'status' } }}
    />,
  );
  expect(screen.getByText('Enrolled')).toBeInTheDocument();
  expect(screen.queryByText('real-answer-uuid')).not.toBeInTheDocument();
});
it('paginates clinical observation collections with correct boundaries', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: {
      type: 'latest-observation',
      values: Array.from({ length: 7 }, (_, i) => ({
        obsUuid: `obs${i}`,
        valueType: 'STRING',
        value: `Observation ${i}`,
      })),
    },
    isLoading: false,
  } as never);
  render(<WidgetRenderer {...props} widget={{ id: 'table', type: 'clinical-table', dataSource: 'source' }} />);
  expect(screen.queryByText('Observation 6')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('Observation 6')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
});
