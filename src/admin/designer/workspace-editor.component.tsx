import React, { useState } from 'react';
import {
  Button,
  Checkbox,
  InlineNotification,
  Search,
  Select,
  SelectItem,
  Stack,
  TextInput,
  Tile,
} from '@carbon/react';
import { Draggable, Edit } from '@carbon/react/icons';
import { WidgetPreview } from './widget-preview.component';
import { WidgetInspector } from './widget-inspector.component';
import { ModelPreview } from './model-preview.component';
import { bindWidgetSource, unavailableWidgets } from '../../widgets/widget-registry';
import { useTranslation } from 'react-i18next';
import type { DefinitionTab, GridPosition, ModelDefinition, WidgetInstance } from '../../types/caremodels';
import { duplicateWidget, moveItem, reorderWidgets, updateDefinitionTab, widgetManifest } from './definition';
import styles from './designer.scss';

export function WorkspaceEditor({
  definition,
  onChange,
  preview = false,
}: {
  definition: ModelDefinition;
  onChange: (next: ModelDefinition) => void;
  preview?: boolean;
}) {
  const { t } = useTranslation();
  const [tabId, setTabId] = useState(definition.workspace.defaultTab ?? definition.workspace.tabs[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<'wide' | 'narrow'>('wide');
  const tabs = definition.workspace.tabs;
  const tab = tabs.find((item) => item.id === tabId) ?? tabs[0];
  const nextRow = Math.max(
    0,
    ...tab.widgets.map((widget, index) => {
      const p = tab.layouts?.wide?.find((item) => item.widgetId === widget.id) ?? widget.position;
      return p ? p.row + p.h : (index + 1) * 2;
    }),
  );
  const selected = tab.widgets.find((widget) => widget.id === selectedId);
  const updateTab = (next: DefinitionTab) => onChange(updateDefinitionTab(definition, next));
  const updateWidget = (next: WidgetInstance) =>
    updateTab({ ...tab, widgets: tab.widgets.map((widget) => (widget.id === next.id ? next : widget)) });
  const index = selected ? tab.widgets.indexOf(selected) : -1;
  const position = selected
    ? (tab.layouts?.[size]?.find((item) => item.widgetId === selected.id) ??
      selected.position ?? { row: index * 2, col: 1, w: 6, h: 2 })
    : null;
  const updatePosition = (key: keyof GridPosition, value: number) => {
    if (!selected || !position) return;
    const next = { row: position.row, col: position.col, w: position.w, h: position.h, [key]: value };
    next.w = Math.max(1, Math.min(next.w, 13 - next.col));
    const items = tab.layouts?.[size] ?? [];
    updateTab({
      ...tab,
      layouts: {
        ...tab.layouts,
        [size]: [...items.filter((item) => item.widgetId !== selected.id), { widgetId: selected.id, ...next }],
      },
    });
  };
  const removeWidget = () => {
    if (!selected) return;
    const layouts = { ...tab.layouts };
    for (const size of ['wide', 'narrow'] as const)
      if (layouts[size]) layouts[size] = layouts[size]!.filter((item) => item.widgetId !== selected.id);
    updateTab({ ...tab, widgets: tab.widgets.filter((widget) => widget.id !== selected.id), layouts });
    setSelectedId(null);
  };
  const addTab = () => {
    let suffix = tabs.length + 1;
    while (tabs.some((item) => item.id === `section-${suffix}`)) suffix++;
    const id = `section-${suffix}`;
    onChange({
      ...definition,
      workspace: {
        ...definition.workspace,
        tabs: [...tabs, { id, label: t('newSection', 'New section'), widgets: [] }],
      },
    });
    setTabId(id);
    setSelectedId(null);
  };
  if (preview) return <ModelPreview definition={definition} />;
  return (
    <Stack gap={5}>
      <div className={styles.tabToolbar}>
        <Select
          id="designer-tab"
          labelText={t('workspaceTab', 'Workspace section')}
          value={tab.id}
          onChange={(e) => {
            setTabId(e.target.value);
            setSelectedId(null);
          }}>
          {tabs.map((item) => (
            <SelectItem key={item.id} value={item.id} text={item.label} />
          ))}
        </Select>
        {!preview && (
          <>
            <TextInput
              id="tab-label"
              labelText={t('sectionLabel', 'Section label')}
              value={tab.label}
              onChange={(e) => updateTab({ ...tab, label: e.target.value })}
            />
            <Button kind="tertiary" disabled={tabs.length >= 10} onClick={addTab}>
              {t('addSection', 'Add section')}
            </Button>
            <Button
              kind="ghost"
              disabled={tabs.indexOf(tab) === 0}
              onClick={() =>
                onChange({
                  ...definition,
                  workspace: {
                    ...definition.workspace,
                    tabs: moveItem(tabs, tabs.indexOf(tab), tabs.indexOf(tab) - 1),
                  },
                })
              }>
              {t('moveSectionEarlier', 'Move section earlier')}
            </Button>
            <Button
              kind="ghost"
              disabled={tabs.indexOf(tab) === tabs.length - 1}
              onClick={() =>
                onChange({
                  ...definition,
                  workspace: {
                    ...definition.workspace,
                    tabs: moveItem(tabs, tabs.indexOf(tab), tabs.indexOf(tab) + 1),
                  },
                })
              }>
              {t('moveSectionLater', 'Move section later')}
            </Button>
            <Button
              kind="danger--ghost"
              disabled={tabs.length === 1}
              onClick={() => {
                const remaining = tabs.filter((item) => item.id !== tab.id);
                onChange({
                  ...definition,
                  workspace: {
                    ...definition.workspace,
                    defaultTab:
                      definition.workspace.defaultTab === tab.id ? remaining[0].id : definition.workspace.defaultTab,
                    tabs: remaining,
                  },
                });
                setTabId(remaining[0].id);
              }}>
              {t('removeSection', 'Remove section')}
            </Button>
            <Checkbox
              id="default-tab"
              labelText={t('defaultSection', 'Default section')}
              checked={definition.workspace.defaultTab === tab.id}
              onChange={(_, { checked }) =>
                checked && onChange({ ...definition, workspace: { ...definition.workspace, defaultTab: tab.id } })
              }
            />
          </>
        )}
        <Select
          id="layout-size"
          labelText={t('layoutSize', 'Layout')}
          value={size}
          onChange={(e) => setSize(e.target.value as typeof size)}>
          <SelectItem value="wide" text={t('wide', 'Wide')} />
          <SelectItem value="narrow" text={t('narrow', 'Narrow')} />
        </Select>
      </div>
      {preview && (
        <InlineNotification
          kind="info"
          title={t('previewNoClinicalData', 'Layout preview — clinical data and actions are disabled.')}
          hideCloseButton
        />
      )}
      <div className={preview ? styles.preview : styles.workspaceStep}>
        {!preview && (
          <div className={styles.palette}>
            <h4>{t('components', 'Components')}</h4>
            <p className={styles.sectionHint}>
              {t('disabledCatalogHint', 'Dimmed components require backend schema or resolver support.')}
            </p>
            <Search
              labelText={t('searchComponents', 'Search components')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              size="sm"
            />
            {(['clinical', 'actions', 'layout', 'advanced'] as const).map((group) => (
              <section key={group}>
                <h5>
                  {t(
                    `paletteGroup.${group}`,
                    {
                      clinical: 'Clinical Data',
                      actions: 'Forms & Actions',
                      layout: 'Layout & Content',
                      advanced: 'Advanced / Specialized',
                    }[group],
                  )}
                </h5>
                {widgetManifest
                  .filter((item) => item.group === group && item.label.toLowerCase().includes(query.toLowerCase()))
                  .map((item) => (
                    <Button
                      key={item.id}
                      kind="ghost"
                      className={styles.paletteItem}
                      disabled={tab.widgets.length >= 50 || nextRow > 100}
                      onClick={() => {
                        const id = `${item.id}-${crypto.randomUUID()}`;
                        updateTab({
                          ...tab,
                          widgets: [
                            ...tab.widgets,
                            {
                              id,
                              type: item.type,
                              componentVersion: item.version,
                              loadingPolicy: 'ON_VISIBLE',
                              position: { row: nextRow, col: 1, ...item.dimensions },
                              properties: {
                                ...item.properties,
                                ...(item.configurable.includes('title') ? { title: item.label } : {}),
                              },
                            },
                          ],
                        });
                        setSelectedId(id);
                      }}>
                      {t(`widget.${item.id}`, item.label)}
                    </Button>
                  ))}
                {unavailableWidgets
                  .filter((item) => item.group === group && item.label.toLowerCase().includes(query.toLowerCase()))
                  .map((item) => (
                    <Button
                      key={item.label}
                      kind="ghost"
                      className={styles.paletteItem}
                      disabled
                      title={t(
                        'widgetBackendUnavailable',
                        'This widget requires backend schema and resolver support.',
                      )}>
                      {t(`widgetCatalog.${item.label}`, item.label)}
                    </Button>
                  ))}
              </section>
            ))}
          </div>
        )}
        <div className={styles.canvas} style={{ maxWidth: size === 'narrow' ? '42rem' : undefined }}>
          {!tab.widgets.length && <p>{t('canvasEmpty', 'Add components from the palette to build this tab.')}</p>}
          {tab.widgets.map((widget, index) => {
            const pos = tab.layouts?.[size]?.find((item) => item.widgetId === widget.id) ??
              widget.position ?? { col: 1, w: 12, row: index * 2, h: 2 };
            return (
              <Tile
                key={widget.id}
                className={`${styles.canvasCard} ${selectedId === widget.id ? styles.canvasCardSelected : ''}`}
                style={{ gridColumn: `${pos.col} / span ${pos.w}`, gridRow: `${pos.row + 1} / span ${pos.h}` }}
                draggable={!preview}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', widget.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = tab.widgets.findIndex((item) => item.id === e.dataTransfer.getData('text/plain'));
                  if (from >= 0) updateTab(reorderWidgets(tab, from, index));
                }}>
                <div className={styles.canvasControls}>
                  <span title={t('dragWidget', 'Drag to reorder widget')}>
                    <Draggable size={16} aria-hidden />
                  </span>
                  <Button
                    kind="ghost"
                    size="sm"
                    hasIconOnly
                    renderIcon={Edit}
                    iconDescription={t('selectWidgetName', 'Select {{name}}', {
                      name: String(widget.properties?.title ?? widget.id),
                    })}
                    onClick={() => setSelectedId(widget.id)}
                    aria-pressed={selectedId === widget.id}
                  />
                </div>
                <WidgetPreview widget={widget} tabId={tab.id} />
              </Tile>
            );
          })}
        </div>
        {!preview && (
          <div className={styles.inspector}>
            <h4>{t('widgetProperties', 'Widget properties')}</h4>
            {selected && position ? (
              <Stack gap={5}>
                <WidgetInspector
                  key={selected.id}
                  widget={selected}
                  definition={definition}
                  position={position}
                  size={size}
                  onWidgetChange={updateWidget}
                  onDefinitionChange={onChange}
                  onPositionChange={updatePosition}
                  onCreateSource={(next, key) =>
                    onChange(
                      updateDefinitionTab(next, {
                        ...tab,
                        widgets: tab.widgets.map((widget) =>
                          widget.id === selected.id ? bindWidgetSource(widget, key, next.dataSources[key]) : widget,
                        ),
                      }),
                    )
                  }
                />
                <Button
                  kind="ghost"
                  disabled={index === 0}
                  onClick={() => updateTab(reorderWidgets(tab, index, index - 1))}>
                  {t('moveEarlier', 'Move earlier')}
                </Button>
                <Button
                  kind="ghost"
                  disabled={index === tab.widgets.length - 1}
                  onClick={() => updateTab(reorderWidgets(tab, index, index + 1))}>
                  {t('moveLater', 'Move later')}
                </Button>
                <Button
                  kind="tertiary"
                  disabled={tab.widgets.length >= 50 || nextRow > 100}
                  onClick={() => {
                    const next = duplicateWidget(tab, selected.id);
                    if (next !== tab) {
                      updateTab(next);
                      setSelectedId(next.widgets[next.widgets.length - 1].id);
                    }
                  }}>
                  {t('duplicateWidget', 'Duplicate widget')}
                </Button>
                <Button kind="danger--ghost" onClick={removeWidget}>
                  {t('removeWidget', 'Remove widget')}
                </Button>
              </Stack>
            ) : (
              <p>{t('selectWidget', 'Select a widget on the canvas to edit it.')}</p>
            )}
          </div>
        )}
      </div>
    </Stack>
  );
}
