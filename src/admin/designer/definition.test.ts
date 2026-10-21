import { blankDefinition, moveItem, reorderWidgets, updateDefinitionTab } from './definition';

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
