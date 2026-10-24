import React, { useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  InlineNotification,
  Search,
  Select,
  SelectItem,
  Stack,
  TextInput,
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
  onConfigureSource,
}: {
  definition: ModelDefinition;
  onChange: (next: ModelDefinition) => void;
  preview?: boolean;
  onConfigureSource?: () => void;
}) {
  const { t } = useTranslation();
  const [tabId, setTabId] = useState(definition.workspace.defaultTab ?? definition.workspace.tabs[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<'wide' | 'narrow'>('wide');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const resizeStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
    w: number;
    h: number;
    columnStep: number;
    rowStep: number;
  } | null>(null);
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
  const setPosition = (positionWidgetId: string, layoutSize: 'wide' | 'narrow', next: GridPosition) => {
    const items = tab.layouts?.[layoutSize] ?? [];
    updateTab({
      ...tab,
      layouts: {
        ...tab.layouts,
        [layoutSize]: [...items.filter((item) => item.widgetId !== positionWidgetId), { widgetId: positionWidgetId, ...next }],
      },
    });
  };
  const updatePosition = (key: keyof GridPosition, value: number) => {
    if (!selected || !position) return;
    const next = { ...position, [key]: value };
    next.row = Math.max(0, Math.min(100, next.row));
    next.col = Math.max(1, Math.min(12, next.col));
    next.w = Math.max(1, Math.min(12, 13 - next.col, next.w));
    next.h = Math.max(1, Math.min(20, next.h));
    setPosition(selected.id, size, next);
  };
  const adjustWidgetSize = (widgetId: string, widgetPosition: GridPosition, key: 'w' | 'h', value: number) => {
    const next = { ...widgetPosition, [key]: value };
    next.w = Math.max(1, Math.min(13 - next.col, 12, next.w));
    next.h = Math.max(1, Math.min(20, next.h));
    setSelectedId(widgetId);
    setPosition(widgetId, size, next);
  };
  const beginResize = (event: React.PointerEvent<HTMLButtonElement>, widgetId: string, widgetPosition: GridPosition) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(widgetId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const styles = window.getComputedStyle(canvas);
    const width = canvas.clientWidth || canvas.getBoundingClientRect().width;
    const columnGap = Number.parseFloat(styles.columnGap) || 0;
    const columns = styles.gridTemplateColumns.split(' ').map((track) => Number.parseFloat(track)).filter(Number.isFinite);
    const columnWidth = columns.length >= 12
      ? columns.slice(0, 12).reduce((sum, current) => sum + current, 0) / 12
      : (width - columnGap * 11) / 12;
    const rows = styles.gridTemplateRows.split(' ').map((track) => Number.parseFloat(track)).filter(Number.isFinite);
    const rowHeight = rows.length ? [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)] : 32;
    resizeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      w: widgetPosition.w,
      h: widgetPosition.h,
      columnStep: Math.max(1, columnWidth + columnGap),
      rowStep: Math.max(1, rowHeight + (Number.parseFloat(styles.rowGap) || 0)),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const resizeWidget = (event: React.PointerEvent<HTMLButtonElement>, widgetId: string) => {
    const start = resizeStart.current;
    if (!start || (event.pointerId !== undefined && event.pointerId !== start.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    const current = tab.layouts?.[size]?.find((item) => item.widgetId === widgetId) ??
      tab.widgets.find((widget) => widget.id === widgetId)?.position ?? { row: 0, col: 1, w: start.w, h: start.h };
    const w = Math.max(1, Math.min(13 - current.col, start.w + Math.round((event.clientX - start.x) / start.columnStep)));
    const h = Math.max(1, Math.min(20, start.h + Math.round((event.clientY - start.y) / start.rowStep)));
    setPosition(widgetId, size, { row: current.row, col: current.col, w, h });
  };
  const endResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeStart.current && (event.pointerId === undefined || event.pointerId === resizeStart.current.pointerId))
      resizeStart.current = null;
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
      {!preview && Object.keys(definition.dataSources).length === 0 && (
        <InlineNotification
          kind="warning"
          title={t('noDataSourcesTitle', 'No data sources defined yet.')}
          subtitle={t(
            'noDataSourcesHint',
            'Widgets show data from sources you define in the Data Sources section (it comes before Workspace). Define a source there first, then select it on each widget here.',
          )}
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
        <div
          ref={canvasRef}
          data-testid="workspace-canvas"
          className={styles.canvas}
          style={{ maxWidth: size === 'narrow' ? '42rem' : undefined }}>
          {!tab.widgets.length && <p>{t('canvasEmpty', 'Add components from the palette to build this tab.')}</p>}
          {tab.widgets.map((widget, index) => {
            const pos = tab.layouts?.[size]?.find((item) => item.widgetId === widget.id) ??
              widget.position ?? { col: 1, w: 12, row: index * 2, h: 2 };
            return (
              <div
                key={widget.id}
                className={`${styles.canvasCard} ${selectedId === widget.id ? styles.canvasCardSelected : ''}`}
                style={{ gridColumn: `${pos.col} / span ${pos.w}`, gridRow: `${pos.row + 1} / span ${pos.h}` }}
                draggable={!preview}
                onDragStart={(e) => {
                  if ((e.target as HTMLElement).closest(`.${styles.resizeHandle}`)) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData('text/plain', widget.id);
                }}
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
                <button
                  type="button"
                  className={styles.resizeHandle}
                  aria-label={t('resizeWidget', 'Resize {{name}}', {
                    name: String(widget.properties?.title ?? widget.id),
                  })}
                  title={t('resizeWidgetHint', 'Drag to resize. Use arrow keys to fine-tune.')}
                  onPointerDown={(event) => beginResize(event, widget.id, pos)}
                  onPointerMove={(event) => resizeWidget(event, widget.id)}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    const key = event.key;
                    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(key)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const delta = event.shiftKey ? 3 : 1;
                    if (key === 'ArrowRight') adjustWidgetSize(widget.id, pos, 'w', pos.w + delta);
                    if (key === 'ArrowLeft') adjustWidgetSize(widget.id, pos, 'w', pos.w - delta);
                    if (key === 'ArrowDown') adjustWidgetSize(widget.id, pos, 'h', pos.h + delta);
                    if (key === 'ArrowUp') adjustWidgetSize(widget.id, pos, 'h', pos.h - delta);
                  }}>
                  <span className={styles.resizeGrip} aria-hidden="true" />
                </button>
              </div>
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
                  onConfigureSource={onConfigureSource}
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
