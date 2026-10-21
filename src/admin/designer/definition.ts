import type { DefinitionTab, ModelDefinition, WidgetInstance } from '../../types/caremodels';

export const widgetManifest: Array<{ type: WidgetInstance['type']; label: string; data: boolean }> = [
  { type: 'metric', label: 'Clinical Metric', data: true },
  { type: 'trend-chart', label: 'Trend Chart', data: true },
  { type: 'clinical-table', label: 'Clinical Table', data: true },
  { type: 'timeline', label: 'Timeline', data: true },
  { type: 'form-launcher', label: 'Form Launcher', data: false },
  { type: 'action-panel', label: 'Quick Actions', data: false },
];
export function blankDefinition(): ModelDefinition {
  return {
    schemaVersion: '1.0.0',
    metadata: { category: 'CHRONIC_CARE', display: { label: '', order: 10 } },
    terminology: {},
    enrollment: { enabled: false, manualEnrollment: { enabled: false, requiresReason: true } },
    dataSources: {},
    workspace: { defaultTab: 'overview', tabs: [{ id: 'overview', label: 'Overview', widgets: [] }] },
    forms: [],
    actions: [],
    pathways: { enabled: false, stages: [], transitions: [] },
    automation: { rules: [] },
    lifecycle: { completion: { mode: 'MANUAL' }, onSourceCorrection: 'FLAG_FOR_REVIEW' },
  };
}
export function updateDefinitionTab(definition: ModelDefinition, tab: DefinitionTab): ModelDefinition {
  return {
    ...definition,
    workspace: {
      ...definition.workspace,
      tabs: definition.workspace.tabs.map((item) => (item.id === tab.id ? tab : item)),
    },
  };
}
export function moveItem<T>(items: Array<T>, from: number, to: number): Array<T> {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export function reorderWidgets(tab: DefinitionTab, from: number, to: number): DefinitionTab {
  const widgets = moveItem(tab.widgets, from, to);
  if (widgets === tab.widgets) return tab;
  // Pack rows using each widget's actual dimensions so reordering cannot overlap cards.
  const pack = (positionOf: (widget: WidgetInstance) => { w: number; h: number }) => {
    let row = 0;
    let col = 1;
    let rowHeight = 0;
    return widgets.map((widget) => {
      const { w, h } = positionOf(widget);
      if (col + w > 13) {
        row += rowHeight;
        col = 1;
        rowHeight = 0;
      }
      const item = { widgetId: widget.id, row, col, w, h };
      col += w;
      rowHeight = Math.max(rowHeight, h);
      return item;
    });
  };
  const positions = pack((widget) => widget.position ?? { w: 12, h: 2 });
  const layouts = { ...tab.layouts };
  for (const size of ['wide', 'narrow'] as const) {
    if (layouts[size])
      layouts[size] = pack(
        (widget) => layouts[size]!.find((item) => item.widgetId === widget.id) ?? widget.position ?? { w: 12, h: 2 },
      );
  }
  if (
    positions.some((item) => item.row > 100) ||
    Object.values(layouts).some((items) => items?.some((item) => item.row > 100))
  )
    return tab;
  return {
    ...tab,
    widgets: widgets.map((widget, i) => {
      const { widgetId, ...position } = positions[i];
      return { ...widget, position };
    }),
    layouts,
  };
}
export function nextVersion(version?: string) {
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return '1.0.0';
  const parts = version.split('.').map(Number);
  parts[2]++;
  return parts.join('.');
}
