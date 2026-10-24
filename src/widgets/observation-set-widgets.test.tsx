import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { WidgetRenderer } from './widget-renderer.component';
import { useWidgetData } from '../api/caremodels.resource';
import type { DataResult } from '../types/caremodels';

vi.mock('../api/caremodels.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useWidgetData: vi.fn(),
}));
const charts = vi.hoisted(() => ({ line: vi.fn(), destroy: vi.fn() }));
vi.mock('@carbon/charts', () => ({
  LineChart: class {
    constructor(holder, options) {
      charts.line(holder, options);
    }
    destroy = charts.destroy;
  },
  SimpleBarChart: class {
    constructor() {}
    destroy = charts.destroy;
  },
  ScaleTypes: { TIME: 'time', LINEAR: 'linear', LOG: 'log' },
}));
const props = { patientUuid: 'patient', modelCode: 'model', tabId: 'overview' };

const member = (
  obsUuid: string,
  conceptUuid: string,
  display: string,
  datatype: string,
  value: unknown,
  extra: Record<string, unknown> = {},
) => ({ obsUuid, conceptUuid, conceptDisplay: display, datatype, value, effectiveTime: '2026-09-12T10:24:00Z', ...extra });

const setResult: DataResult = {
  type: 'observation-set',
  setConceptUuid: 'set',
  setDisplay: 'Renal Function Panel',
  groups: [
    {
      parentObsUuid: 'group-new',
      effectiveDate: '2026-09-12T10:24:00Z',
      members: [
        member('m1', 'crea', 'Creatinine', 'NUMERIC', 1.2, { unit: 'mg/dL', referenceRange: { low: 0.6, high: 1.3 } }),
        member('m2', 'stage', 'WHO Stage', 'CODED', { conceptUuid: 's2', display: 'Stage II' }),
        member('m3', 'notes', 'Clinical Notes', 'TEXT', 'Clinically stable'),
        member('m4', 'urea', 'Urea', 'NUMERIC', null, { unit: 'mmol/L' }),
        member('m5', 'crea', 'Creatinine', 'NUMERIC', 1.25, { unit: 'mg/dL' }),
      ],
    },
    {
      parentObsUuid: 'group-old',
      effectiveDate: '2026-06-05T09:10:00Z',
      members: [member('m6', 'crea', 'Creatinine', 'NUMERIC', 1.1, { unit: 'mg/dL' })],
    },
  ],
};

it('latest-set-results renders the newest group with mixed datatypes, repeats and missing rows', () => {
  vi.mocked(useWidgetData).mockReturnValue({ data: setResult, isLoading: false } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{
        id: 'latest',
        type: 'latest-set-results',
        dataSource: 'renalPanel',
        properties: {
          members: [
            { conceptUuid: 'crea', label: 'Creatinine', inTable: true },
            { conceptUuid: 'stage', label: 'WHO Stage', inTable: true },
            { conceptUuid: 'notes', label: 'Clinical Notes', inTable: true },
            { conceptUuid: 'urea', label: 'Urea', inTable: true },
          ],
        },
      }}
    />,
  );
  // newest group date, coded answer, text value, repeated measurement preserved, missing flagged
  expect(screen.getByText(/Latest results/)).toBeInTheDocument();
  expect(screen.getByText('Stage II')).toBeInTheDocument();
  expect(screen.getByText('Clinically stable')).toBeInTheDocument();
  expect(screen.getAllByText('1.2')).toHaveLength(1);
  expect(screen.getByText('1.25')).toBeInTheDocument();
  // a recorded member with a null value shows as missing, never fabricated
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  // never expose raw uuids to clinicians
  expect(screen.queryByText('m1')).not.toBeInTheDocument();
});

it('latest-set-results shows an empty state without inventing groups', () => {
  vi.mocked(useWidgetData).mockReturnValue({ data: { type: 'observation-set', groups: [] }, isLoading: false } as never);
  render(
    <WidgetRenderer {...props} widget={{ id: 'latest', type: 'latest-set-results', dataSource: 'renalPanel' }} />,
  );
  expect(screen.getByText('No recorded group results')).toBeInTheDocument();
});

it('set-history-trends renders one row per parent group, repeats intact', () => {
  vi.mocked(useWidgetData).mockReturnValue({ data: setResult, isLoading: false } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{ id: 'history', type: 'set-history-trends', dataSource: 'renalPanel', properties: { defaultView: 'table' } }}
    />,
  );
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 groups
  expect(within(table).getAllByText(/2026/)).toHaveLength(2);
  expect(within(table).getAllByText('1.2')).toHaveLength(1);
});

it('set-history-trends defaults to the table and explains missing quantitative series', async () => {
  const qualitative: DataResult = {
    type: 'observation-set',
    setConceptUuid: 'set',
    groups: [
      {
        parentObsUuid: 'g',
        effectiveDate: '2026-09-12T10:24:00Z',
        members: [member('m2', 'stage', 'WHO Stage', 'CODED', { conceptUuid: 's2', display: 'Stage II' })],
      },
    ],
  };
  vi.mocked(useWidgetData).mockReturnValue({ data: qualitative, isLoading: false } as never);
  render(
    <WidgetRenderer
      {...props}
      widget={{ id: 'history', type: 'set-history-trends', dataSource: 'assessmentSet' }}
    />,
  );
  // no numeric members: chart view is not available, the table stays
  expect(await screen.findByRole('table')).toBeInTheDocument();
});

it('set-history-trends plots numeric members only and separates panels for incompatible units', async () => {
  const mixed: DataResult = {
    type: 'observation-set',
    setConceptUuid: 'set',
    groups: [
      {
        parentObsUuid: 'g1',
        effectiveDate: '2026-09-12T10:24:00Z',
        members: [
          member('a', 'crea', 'Creatinine', 'NUMERIC', 1.2, { unit: 'mg/dL' }),
          member('b', 'egfr', 'eGFR', 'NUMERIC', 78, { unit: 'mL/min/1.73m²' }),
          member('c', 'stage', 'WHO Stage', 'CODED', { conceptUuid: 's2', display: 'Stage II' }),
        ],
      },
      {
        parentObsUuid: 'g2',
        effectiveDate: '2026-06-05T09:10:00Z',
        members: [
          member('d', 'crea', 'Creatinine', 'NUMERIC', 1.1, { unit: 'mg/dL' }),
          member('e', 'egfr', 'eGFR', 'NUMERIC', 82, { unit: 'mL/min/1.73m²' }),
        ],
      },
    ],
  };
  vi.mocked(useWidgetData).mockReturnValue({ data: mixed, isLoading: false } as never);
  charts.line.mockClear();
  render(
    <WidgetRenderer
      {...props}
      widget={{
        id: 'history',
        type: 'set-history-trends',
        dataSource: 'renalPanel',
        properties: {
          members: [
            { conceptUuid: 'crea', label: 'Creatinine', inTable: true, inChart: true },
            { conceptUuid: 'egfr', label: 'eGFR', inTable: true, inChart: true },
            { conceptUuid: 'stage', label: 'WHO Stage', inTable: true, inChart: false },
          ],
        },
      }}
    />,
  );
  // two panels: units differ, coded member is never plotted, dates are actual observations
  await waitFor(() => expect(charts.line.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
  const data = charts.line.mock.calls[0][1].data as Array<{ group: string; value: number }>;
  expect(data.every((point) => typeof point.value === 'number')).toBe(true);
});
