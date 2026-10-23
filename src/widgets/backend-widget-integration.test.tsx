import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useWidgetData } from '../api/caremodels.resource';
import { parseDataResult, parseWorkspace } from '../api/contract';
import { WidgetRenderer } from './widget-renderer.component';
import { WidgetPreview } from '../admin/designer/widget-preview.component';
import { widgetManifest, sourceCompatibility } from './widget-registry';
import { parseDefinitionJson } from '../admin/designer/definition-validation';
import { blankDefinition } from '../admin/designer/definition';
import { WorkspaceDescriptorContext } from './workspace-descriptors';
import { getGlobalStore, launchWorkspace2, showModal } from '@openmrs/esm-framework';
vi.mock('../api/caremodels.resource', async (original) => ({ ...(await original<object>()), useWidgetData: vi.fn() }));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getGlobalStore: vi.fn(),
}));

/** Emulates the patient chart's visit-context store (patient-chart-global-store). */
function fakeChartStore(initial: Record<string, unknown> = {}) {
  let state: Record<string, unknown> = {
    patientUuid: null,
    visitContext: null,
    workspaceGroupVisitUuid: null,
    ...initial,
  };
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    setState(next: Record<string, unknown>) {
      state = { ...state, ...next };
      listeners.forEach((listener) => listener());
    },
  };
}
const context = { patientUuid: 'patient', modelCode: 'model', tabId: 'overview' };
beforeEach(() =>
  vi.mocked(useWidgetData).mockReturnValue({ data: undefined, error: undefined, isLoading: false } as never),
);
it.each(['text-note', 'section-heading', 'divider', 'spacer', 'static-callout'])(
  'persists %s and never executes a clinical hook',
  (type) => {
    const manifest = widgetManifest.find((item) => item.type === type)!;
    const definition = blankDefinition();
    definition.metadata.display.label = 'Test model';
    const widget = { id: 'static', type: manifest.type, properties: manifest.properties };
    definition.workspace.tabs[0].widgets = [widget];
    expect(parseDefinitionJson(JSON.stringify(definition)).errors).toEqual([]);
    render(<WidgetRenderer widget={widget} {...context} />);
    expect(useWidgetData).not.toHaveBeenCalled();
  },
);
it('renders plain text without interpreting markup', () => {
  render(
    <WidgetRenderer
      widget={{ id: 'note', type: 'text-note', properties: { text: '<script>alert(1)</script>' } }}
      {...context}
    />,
  );
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
});
it.each([
  [
    'condition-list',
    'conditions',
    { uuid: 'one', name: 'Documented condition', clinicalStatus: 'ACTIVE' },
    'Documented condition',
  ],
  [
    'condition-list',
    'encounter-diagnoses',
    { uuid: 'one', name: 'Historical diagnosis', certainty: 'CONFIRMED' },
    'Historical diagnosis',
  ],
  [
    'medication-summary',
    'order-query',
    { uuid: 'one', drugName: 'Recorded medication', activeAtAssessment: false },
    'Recorded medication',
  ],
  [
    'program-summary',
    'program-state',
    { uuid: 'one', dateEnrolled: '2026-01-01', currentStates: [] },
    'Enrollment date:',
  ],
])('renders authorized %s records from %s', (widgetType, type, record, label) => {
  const data = parseDataResult(JSON.stringify({ type, records: [record] }));
  vi.mocked(useWidgetData).mockReturnValue({ data, error: undefined, isLoading: false } as never);
  render(
    <WidgetRenderer
      widget={{ id: 'record', type: widgetType as 'condition-list', dataSource: 'source' }}
      {...context}
    />,
  );
  expect(screen.getByText(String(label), { exact: false })).toBeInTheDocument();
});
it('renders selected patient fields only', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: parseDataResult(
      JSON.stringify({ type: 'patient-summary', fields: { name: 'Authorized name', dead: false } }),
    ),
    isLoading: false,
  } as never);
  render(<WidgetRenderer widget={{ id: 'summary', type: 'patient-summary', dataSource: 'source' }} {...context} />);
  expect(screen.getByText('Authorized name')).toBeInTheDocument();
  expect(screen.getByText('No')).toBeInTheDocument();
});
it.each([
  { type: 'conditions', records: [{ uuid: 'one', name: { unsafe: 'value' } }] },
  { type: 'program-state', records: [{ uuid: 'one', currentStates: [null] }] },
  { type: 'patient-summary', fields: { identifier: 'not approved' } },
])('rejects malformed typed clinical output %j', (result) =>
  expect(() => parseDataResult(JSON.stringify(result))).toThrow(),
);
it('accepts encounter binding and renders actual encounter events', () => {
  expect(
    sourceCompatibility(
      { id: 'timeline', type: 'timeline' },
      { type: 'encounter-query', encounterTypeAlias: 'followup', resultType: 'TABLE' },
    ),
  ).toBeNull();
  vi.mocked(useWidgetData).mockReturnValue({
    data: {
      type: 'encounter-query',
      records: [
        {
          uuid: 'encounter',
          effectiveTime: '2026-01-01',
          encounterTypeName: 'Documented encounter',
          status: 'recorded',
        },
      ],
    },
    isLoading: false,
  } as never);
  render(<WidgetRenderer widget={{ id: 'events', type: 'timeline', dataSource: 'source' }} {...context} />);
  expect(screen.getByText('Documented encounter')).toBeInTheDocument();
  expect(screen.getByText('recorded')).toBeInTheDocument();
});
it('launches an authorized form in the chart form-entry workspace with the visit context', async () => {
  vi.mocked(getGlobalStore).mockReturnValue(
    fakeChartStore({
      patientUuid: 'patient',
      visitContext: { uuid: 'visit-9', display: 'Facility Visit @ ART Clinic' },
      workspaceGroupVisitUuid: 'visit-9',
    }) as never,
  );
  render(
    <WorkspaceDescriptorContext.Provider
      value={{
        version: '1.0.0',
        forms: [
          {
            alias: 'followup',
            available: true,
            formUuid: 'form-9',
            name: 'Followup form',
            version: '1.2',
            encounterTypeUuid: 'type-9',
            encounterTypeName: 'Followup',
          },
        ],
        actions: [],
      }}>
      <WidgetRenderer widget={{ id: 'launcher', type: 'form-launcher', formAlias: 'followup' }} {...context} />
    </WorkspaceDescriptorContext.Provider>,
  );
  const open = screen.getByRole('button', { name: 'Open form' });
  expect(open).toHaveAttribute('title', 'Saves to the current visit: Facility Visit @ ART Clinic');
  fireEvent.click(open);
  expect(launchWorkspace2).toHaveBeenCalledWith('patient-form-entry-workspace', {
    form: {
      uuid: 'form-9',
      name: 'Followup form',
      display: 'Followup form',
      version: '1.2',
      published: true,
      retired: false,
      resources: [],
      encounterType: { uuid: 'type-9', name: 'Followup' },
    },
  });
});
it('offers the start-visit dialog and launches only after the visit context exists', async () => {
  const store = fakeChartStore({ patientUuid: 'patient' });
  vi.mocked(getGlobalStore).mockReturnValue(store as never);
  render(
    <WorkspaceDescriptorContext.Provider
      value={{
        version: '1.0.0',
        forms: [{ alias: 'followup', available: true, formUuid: 'form-9', name: 'Followup form' }],
        actions: [],
      }}>
      <WidgetRenderer widget={{ id: 'launcher', type: 'form-launcher', formAlias: 'followup' }} {...context} />
    </WorkspaceDescriptorContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open form' }));
  expect(launchWorkspace2).not.toHaveBeenCalled();
  expect(showModal).toHaveBeenCalledWith(
    'start-visit-dialog',
    expect.objectContaining({ patientUuid: 'patient' }),
  );
  // The chart starts the visit and relaunches its workspace group; the launcher must wait for it.
  const onVisitStarted = vi.mocked(showModal).mock.calls[0][1].onVisitStarted as () => void;
  onVisitStarted();
  store.setState({
    patientUuid: 'patient',
    visitContext: { uuid: 'visit-10', display: 'Facility Visit' },
    workspaceGroupVisitUuid: 'visit-10',
  });
  await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledWith('patient-form-entry-workspace', {
    form: expect.objectContaining({ uuid: 'form-9' }),
  }));
});
it('shows recorded pathway metadata without inferring completion', () => {
  render(
    <WorkspaceDescriptorContext.Provider
      value={{
        version: '1.0.0',
        forms: [],
        actions: [],
        pathway: { status: 'recorded', label: 'Review stage', enteredAt: '2026-01-01' },
      }}>
      <WidgetRenderer widget={{ id: 'plan', type: 'care-plan' }} {...context} />
    </WorkspaceDescriptorContext.Provider>,
  );
  expect(screen.getByText('Review stage')).toBeInTheDocument();
  expect(useWidgetData).not.toHaveBeenCalled();
});
it('rejects malformed workspace descriptors', () => {
  expect(() =>
    parseWorkspace({
      modelCode: 'model',
      modelUuid: 'model',
      memberUuid: 'member',
      tabId: 'overview',
      tabLabel: 'Overview',
      widgets: [],
      descriptors: { version: '1.0.0', forms: [{ alias: 'form', available: 'yes' }], actions: [] },
    }),
  ).toThrow();
});
it('does not execute clinical hooks for a static designer preview', () => {
  render(
    <WidgetPreview
      tabId="overview"
      widget={{ id: 'note', type: 'text-note', properties: { text: 'Preview guidance' } }}
    />,
  );
  expect(screen.getByText('Preview data')).toBeInTheDocument();
  expect(useWidgetData).not.toHaveBeenCalled();
});
it('suppresses records on authorization loss', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: { type: 'conditions', records: [{ uuid: 'one', name: 'Stale condition' }] },
    error: { status: 403 },
    isLoading: false,
  } as never);
  render(<WidgetRenderer widget={{ id: 'conditions', type: 'condition-list', dataSource: 'source' }} {...context} />);
  expect(screen.queryByText('Stale condition')).not.toBeInTheDocument();
  expect(screen.getByText('You no longer have access to this clinical information')).toBeInTheDocument();
});
it('renders typed records as a bounded Carbon table using declared fields', () => {
  vi.mocked(useWidgetData).mockReturnValue({
    data: parseDataResult(
      JSON.stringify({
        type: 'encounter-query',
        records: [{ uuid: 'encounter', encounterTypeName: 'Documented follow-up', effectiveTime: '2026-01-01' }],
        availableFields: ['uuid', 'encounterTypeName', 'effectiveTime'],
        truncated: true,
      }),
    ),
    isLoading: false,
  } as never);
  render(
    <WidgetRenderer
      widget={{
        id: 'table',
        type: 'clinical-table',
        dataSource: 'source',
      }}
      {...context}
    />,
  );
  expect(screen.getByRole('columnheader', { name: 'encounterTypeName' })).toBeInTheDocument();
  expect(screen.getByText('Documented follow-up')).toBeInTheDocument();
  expect(
    screen.getByText('Additional records exist. Increase the source limit or narrow the date window.'),
  ).toBeInTheDocument();
});
