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
  ScaleTypes: { TIME: 'time', LINEAR: 'linear', LOG: 'log' },
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

it('renders shared metric units, precision, neutral reference and compact observation date from real result fields', () => {
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
  expect(screen.getByText('Configured reference: — – 6')).toBeInTheDocument();
  expect(screen.queryByText('Outside target')).not.toBeInTheDocument();
  expect(screen.getByText(new Date('2026-02-01T00:00:00').toLocaleDateString())).toBeInTheDocument();
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

it.each(['metric', 'trend-chart', 'clinical-table', 'timeline'] as const)(
  'distinguishes loading and unauthorized states for %s without stale results',
  (type) => {
    vi.mocked(useWidgetData).mockReturnValue({ isLoading: true } as never);
    const { rerender } = render(<WidgetRenderer {...props} widget={{ id: 'widget', type, dataSource: 'source' }} />);
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument();
    vi.mocked(useWidgetData).mockReturnValue({
      isLoading: false,
      error: { status: 403 },
      data: { type: 'latest-observation', values: [{ obsUuid: 'obs', valueType: 'NUMBER', value: 999 }] },
    } as never);
    rerender(<WidgetRenderer {...props} widget={{ id: 'widget', type, dataSource: 'source' }} />);
    expect(screen.getByText('You no longer have access to this clinical information')).toBeInTheDocument();
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  },
);
it('rejects unsupported widget properties before invoking a clinical hook', () => {
  render(
    <WidgetRenderer
      {...props}
      widget={{ id: 'bad', type: 'metric', dataSource: 'source', properties: { precision: 99 } }}
    />,
  );
  expect(screen.getByText('Invalid configuration')).toBeInTheDocument();
  expect(useWidgetData).not.toHaveBeenCalled();
});
it('keeps qualified strings intact and matches only explicit status mappings', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    isLoading: false,
    data: {
      type: 'latest-observation',
      values: [{ obsUuid: 'obs', valueType: 'STRING', value: '<50', effectiveTime: '2026-01-01' }],
    },
  } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{
        id: 'metric',
        type: 'metric',
        dataSource: 'source',
        properties: {
          showDate: false,
          precision: 2,
          showStatus: true,
          statusMappings: [{ value: '<50', label: 'Configured label', tone: 'teal' }],
        },
      }}
    />,
  );
  expect(screen.getByText('<50')).toBeInTheDocument();
  expect(screen.getByText('Configured label')).toBeInTheDocument();
  expect(screen.queryByText(/^Recorded /)).not.toBeInTheDocument();
});
it('orders equal timestamps deterministically and excludes nonpositive log points', () => {
  const data = {
    type: 'latest-observation',
    values: [
      { obsUuid: 'b', valueType: 'NUMBER' as const, value: 0, effectiveTime: '2026-01-01' },
      { obsUuid: 'a', valueType: 'NUMBER' as const, value: 10, effectiveTime: '2026-01-01' },
      { obsUuid: 'c', valueType: 'STRING' as const, value: '<50', effectiveTime: '2026-01-01' },
    ],
  };
  expect(chartPoints(data).map((point) => point.obsUuid)).toEqual(['a', 'b']);
  expect(chartPoints(data, true).map((point) => point.obsUuid)).toEqual(['a']);
});
it('uses approved observation column bindings and configured sorting', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    isLoading: false,
    data: {
      type: 'latest-observation',
      values: [
        { obsUuid: 'a', valueType: 'NUMBER', value: 10 },
        { obsUuid: 'b', valueType: 'NUMBER', value: 2 },
      ],
    },
  } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{
        id: 'table',
        type: 'clinical-table',
        dataSource: 'source',
        properties: { columns: [{ field: 'value', label: 'Result' }], sortBy: 'value', sortOrder: 'asc' },
      }}
    />,
  );
  expect(screen.getByRole('columnheader', { name: 'Result' })).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Date' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['2', '10']);
});
it('retains qualified observations in the chart table and reports excluded log values', async () => {
  vi.mocked(useWidgetData).mockReturnValue({
    isLoading: false,
    data: {
      type: 'latest-observation',
      values: [
        { obsUuid: 'one', valueType: 'NUMBER', value: 10, effectiveTime: '2026-01-01' },
        { obsUuid: 'zero', valueType: 'NUMBER', value: 0, effectiveTime: '2026-01-02' },
        { obsUuid: 'qualified', valueType: 'STRING', value: '<50', effectiveTime: '2026-01-03' },
      ],
    },
  } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{ id: 'chart', type: 'trend-chart', dataSource: 'source', properties: { scaleType: 'log' } }}
    />,
  );
  expect(screen.getByText('Some results are not plotted')).toBeInTheDocument();
  expect(screen.getByText('<50')).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
  await waitFor(() => expect(charts.line).toHaveBeenCalled());
  expect(charts.line.mock.calls.at(-1)![1].data).toHaveLength(1);
});

it('renders multiple authorized observation series with distinct chart groups', async () => {
  vi.mocked(useWidgetData).mockImplementation(
    (_patient, _model, _tab, source) =>
      ({
        data: {
          type: 'latest-observation',
          units: 'mmHg',
          values: [
            {
              obsUuid: String(source),
              valueType: 'NUMBER',
              value: source === 'systolic' ? 120 : 80,
              effectiveTime: '2026-01-01',
            },
          ],
        },
        isLoading: false,
      }) as never,
  );
  render(
    <WidgetRenderer
      {...props}
      widget={{ id: 'blood-pressure', type: 'trend-chart', dataSources: ['systolic', 'diastolic'] }}
    />,
  );
  await waitFor(() => expect(charts.line).toHaveBeenCalled());
  const options = charts.line.mock.calls.at(-1)?.[1];
  expect(options.data.map((point) => point.group).sort()).toEqual(['diastolic', 'systolic']);
  expect(useWidgetData).toHaveBeenCalledWith(props.patientUuid, props.modelCode, props.tabId, 'systolic');
  expect(useWidgetData).toHaveBeenCalledWith(props.patientUuid, props.modelCode, props.tabId, 'diastolic');
});
it('rejects multi-series chart results with incompatible units', () => {
  vi.mocked(useWidgetData).mockImplementation(
    (_patient, _model, _tab, source) =>
      ({
        data: { type: 'latest-observation', units: source === 'first' ? 'kg' : 'cm', values: [] },
        isLoading: false,
      }) as never,
  );
  render(
    <WidgetRenderer
      {...props}
      widget={{ id: 'incompatible', type: 'trend-chart', dataSources: ['first', 'second'] }}
    />,
  );
  expect(
    screen.getByText('Chart series require matching explicit units. Use separate charts for these sources.'),
  ).toBeInTheDocument();
});
