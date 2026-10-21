import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
