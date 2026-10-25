import { blankDefinition, duplicateWidget, moveItem, reorderWidgets, updateDefinitionTab } from './definition';

it('editing one tab preserves every other tab and unrelated configuration', () => {
  const definition = blankDefinition();
  definition.workspace.tabs.push({
    id: 'history',
    label: 'History',
    widgets: [{ id: 'history-widget', type: 'metric', dataSource: 'source' }],
  });
  definition.actions = [{ id: 'action', label: 'Action', type: 'launch-form', formAlias: 'form' }];
  const edited = updateDefinitionTab(definition, {
    ...definition.workspace.tabs[0],
    widgets: [{ id: 'metric', type: 'metric', dataSource: 'source' }],
  });
  expect(edited.workspace.tabs).toHaveLength(2);
  expect(edited.workspace.tabs[1]).toBe(definition.workspace.tabs[1]);
  expect(edited.actions).toBe(definition.actions);
  expect(definition.workspace.tabs[0].widgets).toEqual([]);
});

it('reorders widgets and their responsive layout rows without dropping dimensions', () => {
  const tab = {
    id: 'overview',
    label: 'Overview',
    widgets: [
      { id: 'a', type: 'metric' as const },
      { id: 'b', type: 'metric' as const },
    ],
    layouts: {
      wide: [
        { widgetId: 'a', row: 0, col: 1, w: 4, h: 2 },
        { widgetId: 'b', row: 1, col: 1, w: 8, h: 3 },
      ],
    },
  };
  const result = reorderWidgets(tab, 1, 0);
  expect(result.widgets.map((w) => w.id)).toEqual(['b', 'a']);
  expect(result.layouts?.wide?.[0]).toEqual({ widgetId: 'b', row: 0, col: 1, w: 8, h: 3 });
  expect(tab.widgets[0].id).toBe('a');
  expect(moveItem(tab.widgets, -1, 0)).toBe(tab.widgets);
});

it('duplicates widget properties independently and preserves responsive source/layout bindings', () => {
  const tab = {
    id: 'overview',
    label: 'Overview',
    widgets: [
      {
        id: 'metric',
        type: 'metric' as const,
        dataSource: 'source',
        properties: { title: 'Metric', columns: [{ field: 'value', label: 'Result' }] },
        position: { row: 0, col: 1, w: 6, h: 3 },
      },
    ],
    layouts: {
      wide: [{ widgetId: 'metric', row: 0, col: 1, w: 6, h: 3 }],
      narrow: [{ widgetId: 'metric', row: 0, col: 1, w: 12, h: 2 }],
    },
  };
  const next = duplicateWidget(tab, 'metric');
  expect(next.widgets).toHaveLength(2);
  expect(next.widgets[1].id).not.toBe('metric');
  expect(next.widgets[1].dataSource).toBe('source');
  expect(next.layouts?.wide?.[1]).toMatchObject({ row: 3, w: 6 });
  expect(next.layouts?.narrow?.[1]).toMatchObject({ row: 2, w: 12 });
  expect(next.widgets[1].properties).not.toBe(tab.widgets[0].properties);
  expect(tab.widgets).toHaveLength(1);
});
