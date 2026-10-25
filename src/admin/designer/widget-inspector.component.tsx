import React, { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  TextInput,
  TextArea,
} from '@carbon/react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import type { GridPosition, ModelDefinition, WidgetInstance } from '../../types/caremodels';
import { fetchConceptSetDetails } from '../../api/caremodels.resource';
import {
  bindWidgetSource,
  fieldsForSource,
  manifestFor,
  sourceCompatibility,
  widgetManifest,
} from '../../widgets/widget-registry';
import { configuredMembers } from '../../widgets/observation-set-format';
import { StatusMappingsEditor } from './status-mappings-editor.component';
import { isStaticWidget } from '../../widgets/widget-properties';
import { DataSourceBuilder, SourceSettings } from './data-source-builder.component';
import { MoveUpDown } from './data-source-set-shared.component';
import styles from './designer.scss';

const setWidgetTypes = ['latest-set-results', 'set-history-trends'];

export function WidgetInspector({
  widget,
  definition,
  onWidgetChange,
  onDefinitionChange,
  onCreateSource,
  onConfigureSource,
  position,
  onPositionChange,
  size,
}: {
  widget: WidgetInstance;
  definition: ModelDefinition;
  onWidgetChange: (widget: WidgetInstance) => void;
  onDefinitionChange: (definition: ModelDefinition) => void;
  onCreateSource: (definition: ModelDefinition, key: string) => void;
  onConfigureSource?: () => void;
  position: GridPosition;
  onPositionChange: (key: keyof GridPosition, value: number) => void;
  size: 'wide' | 'narrow';
}) {
  const { t } = useTranslation();
  const [createSource, setCreateSource] = useState(false);
  const manifest = manifestFor(widget);
  const mismatch = manifest?.data
    ? widget.dataSources?.length
      ? widget.dataSources.map((key) => sourceCompatibility(widget, definition.dataSources[key])).find(Boolean)
      : sourceCompatibility(widget, definition.dataSources[widget.dataSource ?? ''])
    : null;
  const property = (key: string, value: unknown) =>
    onWidgetChange({ ...widget, properties: { ...widget.properties, [key]: value } });
  return (
    <Tabs>
      <TabList aria-label={t('widgetPropertyTabs', 'Widget property tabs')}>
        <Tab>{t('content', 'Content')}</Tab>
        <Tab>{t('dataSource', 'Data source')}</Tab>
        <Tab>{t('display', 'Display')}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <Stack gap={5}>
            {!isStaticWidget(widget) && (
              <TextInput
                id="inspector-title"
                labelText={t('title', 'Title')}
                value={String(widget.properties?.title ?? '')}
                onChange={(event) => property('title', event.target.value)}
              />
            )}
            <Select
              id="inspector-widget-type"
              labelText={t('widgetType', 'Widget type')}
              value={manifest?.id ?? widget.type}
              onChange={(event) => {
                const next = widgetManifest.find((item) => item.id === event.target.value)!;
                const updated = {
                  ...widget,
                  type: next.type,
                  properties: {
                    ...Object.fromEntries(
                      Object.entries(
                        isStaticWidget({ ...widget, type: next.type }) ? {} : (widget.properties ?? {}),
                      ).filter(
                        ([key]) =>
                          next.configurable.includes(key) &&
                          ['title', 'subtitle', 'description', 'emptyText', 'emptyMessage'].includes(key),
                      ),
                    ),
                    ...next.properties,
                    ...(next.type === 'metric'
                      ? {
                          presentation:
                            next.id === 'clinical-status'
                              ? 'status'
                              : next.id === 'key-value-metric'
                                ? 'key-value'
                                : next.id === 'date-metric'
                                  ? 'date'
                                  : 'value',
                        }
                      : {}),
                  },
                };
                if (!next.data || sourceCompatibility(updated, definition.dataSources[widget.dataSource ?? '']))
                  delete updated.dataSource;
                if (next.type !== 'trend-chart') delete updated.dataSources;
                if (next.group === 'layout') {
                  delete updated.formAlias;
                  delete updated.actionIds;
                  delete updated.formAliases;
                  delete updated.dataSources;
                }
                onWidgetChange(updated);
              }}>
              {widgetManifest.map((item) => (
                <SelectItem key={item.id} value={item.id} text={t(`widget.${item.id}`, item.label)} />
              ))}
            </Select>
            {!isStaticWidget(widget) &&
              ['subtitle', 'description']
                .filter((key) => manifest?.configurable.includes(key))
                .map((key) => (
                  <TextInput
                    key={key}
                    id={`widget-${key}`}
                    labelText={key === 'subtitle' ? t('subtitle', 'Subtitle') : t('description', 'Description')}
                    value={String(widget.properties?.[key] ?? '')}
                    onChange={(event) => property(key, event.target.value)}
                  />
                ))}
            {isStaticWidget(widget) && (
              <>
                {['text-note', 'section-heading', 'static-callout'].includes(widget.type) && (
                  <TextArea
                    id="static-text"
                    labelText={t('staticText', 'Text')}
                    value={String(widget.properties?.text ?? '')}
                    maxLength={4000}
                    onChange={(event) => property('text', event.target.value)}
                  />
                )}
                {widget.type === 'section-heading' && (
                  <Select
                    id="heading-level"
                    labelText={t('headingLevel', 'Heading level')}
                    value={String(widget.properties?.level ?? 2)}
                    onChange={(event) => property('level', Number(event.target.value))}>
                    {[2, 3, 4, 5, 6].map((level) => (
                      <SelectItem key={level} value={String(level)} text={String(level)} />
                    ))}
                  </Select>
                )}
                {widget.type === 'spacer' && (
                  <Select
                    id="spacer-size"
                    labelText={t('spacing', 'Spacing')}
                    value={String(widget.properties?.size ?? 'medium')}
                    onChange={(event) => property('size', event.target.value)}>
                    {['small', 'medium', 'large'].map((size) => (
                      <SelectItem key={size} value={size} text={t(size, size)} />
                    ))}
                  </Select>
                )}
                {widget.type === 'divider' && (
                  <Select
                    id="divider-orientation"
                    labelText={t('orientation', 'Orientation')}
                    value={String(widget.properties?.orientation ?? 'horizontal')}
                    onChange={(event) => property('orientation', event.target.value)}>
                    {['horizontal', 'vertical'].map((value) => (
                      <SelectItem key={value} value={value} text={t(value, value)} />
                    ))}
                  </Select>
                )}
                {widget.type === 'static-callout' && (
                  <>
                    <TextInput
                      id="callout-title"
                      labelText={t('title', 'Title')}
                      maxLength={100}
                      value={String(widget.properties?.title ?? '')}
                      onChange={(event) => property('title', event.target.value)}
                    />
                    <Select
                      id="callout-tone"
                      labelText={t('severity', 'Severity')}
                      value={String(widget.properties?.tone ?? 'info')}
                      onChange={(event) => property('tone', event.target.value)}>
                      {['info', 'success', 'warning', 'error'].map((value) => (
                        <SelectItem key={value} value={value} text={t(value, value)} />
                      ))}
                    </Select>
                  </>
                )}
              </>
            )}
            {widget.type === 'form-launcher' && (
              <>
                <TextInput
                  id="form-button-label"
                  labelText={t('buttonLabel', 'Button label')}
                  value={String(widget.properties?.buttonLabel ?? '')}
                  onChange={(event) => property('buttonLabel', event.target.value)}
                />
                <Select
                  id="inspector-form"
                  labelText={t('form', 'Form')}
                  value={widget.formAlias ?? ''}
                  onChange={(event) => onWidgetChange({ ...widget, formAlias: event.target.value || undefined })}>
                  <SelectItem value="" text={t('selectForm', 'Select a form')} />
                  {definition.forms.map((form) => (
                    <SelectItem key={form.alias} value={form.alias} text={form.alias} />
                  ))}
                </Select>
                {definition.forms.map((form) => (
                  <Checkbox
                    key={form.alias}
                    id={`additional-form-${form.alias}`}
                    labelText={form.alias}
                    checked={widget.formAliases?.includes(form.alias) ?? false}
                    disabled={!widget.formAliases?.includes(form.alias) && (widget.formAliases?.length ?? 0) >= 10}
                    onChange={(_, { checked }) => {
                      const aliases = checked
                        ? [...(widget.formAliases ?? []), form.alias]
                        : widget.formAliases?.filter((alias) => alias !== form.alias);
                      const updated = { ...widget };
                      if (aliases?.length) updated.formAliases = aliases;
                      else delete updated.formAliases;
                      onWidgetChange(updated);
                    }}
                  />
                ))}
              </>
            )}
            {widget.type === 'action-panel' &&
              definition.actions.map((action) => (
                <Checkbox
                  key={action.id}
                  id={`action-${action.id}`}
                  labelText={action.label}
                  checked={widget.actionIds?.includes(action.id) ?? false}
                  onChange={(_, { checked }) =>
                    onWidgetChange({
                      ...widget,
                      actionIds: checked
                        ? [...(widget.actionIds ?? []), action.id]
                        : widget.actionIds?.filter((id) => id !== action.id),
                      properties: {
                        ...widget.properties,
                        actionLabels: Object.fromEntries(definition.actions.map((item) => [item.id, item.label])),
                      },
                    })
                  }
                />
              ))}
          </Stack>
        </TabPanel>
        <TabPanel>
          <Stack gap={5}>
            {manifest?.data ? (
              <>
                <p>
                  {t(
                    'dataSourceListHint',
                    'Sources listed here are declared by this model definition. Add or edit them in the Data Sources section.',
                  )}
                </p>
                <Select
                  id="inspector-source"
                  labelText={t('dataSource', 'Data source')}
                  value={widget.dataSource ?? ''}
                  onChange={(event) =>
                    onWidgetChange(
                      bindWidgetSource(widget, event.target.value, definition.dataSources[event.target.value]),
                    )
                  }>
                  <SelectItem value="" text={t('selectDataSource', 'Select a data source')} />
                  {Object.entries(definition.dataSources).map(([key, source]) => {
                    const reason = sourceCompatibility(widget, source);
                    return (
                      <SelectItem
                        key={key}
                        value={key}
                        text={reason ? `${key} — ${t('incompatible', 'incompatible')}` : key}
                        disabled={Boolean(reason)}
                      />
                    );
                  })}
                </Select>
                {widget.type === 'trend-chart' && (
                  <>
                    <p>
                      {t(
                        'additionalChartSources',
                        'Multiple chart sources require matching explicit units. Selecting these replaces the single-source binding.',
                      )}
                    </p>
                    {Object.entries(definition.dataSources)
                      .filter(([, source]) => !sourceCompatibility(widget, source))
                      .map(([key, source]) => (
                        <Checkbox
                          key={key}
                          id={`series-${key}`}
                          labelText={`${key} · ${source.units ?? t('unitsRequired', 'units required')}`}
                          checked={widget.dataSources?.includes(key) ?? false}
                          disabled={
                            !widget.dataSources?.includes(key) &&
                            ((widget.dataSources?.length ?? 0) >= 8 ||
                              !source.units ||
                              Boolean(
                                widget.dataSources?.some(
                                  (selected) => definition.dataSources[selected]?.units !== source.units,
                                ),
                              ))
                          }
                          onChange={(_, { checked }) => {
                            const keys = checked
                              ? [...(widget.dataSources ?? []), key]
                              : widget.dataSources?.filter((id) => id !== key);
                            const updated = { ...widget };
                            delete updated.dataSource;
                            if (keys?.length) updated.dataSources = keys;
                            else delete updated.dataSources;
                            onWidgetChange(updated);
                          }}
                        />
                      ))}
                  </>
                )}
                {mismatch && (
                  <InlineNotification
                    kind="warning"
                    hideCloseButton
                    title={t('incompatibleSource', 'Incompatible data source')}
                    subtitle={t(`sourceCompatibility.${mismatch}`, mismatch)}
                  />
                )}
                {setWidgetTypes.includes(widget.type) && widget.dataSource && (
                  <SetWidgetMembers widget={widget} definition={definition} onWidgetChange={onWidgetChange} />
                )}
                {widget.dataSource && !setWidgetTypes.includes(widget.type) && (
                  <SourceSettings
                    key={widget.dataSource}
                    sourceKey={widget.dataSource}
                    definition={definition}
                    onChange={onDefinitionChange}
                  />
                )}
                {setWidgetTypes.includes(widget.type) && (
                  <Button
                    kind="tertiary"
                    disabled={!widget.dataSource}
                    onClick={() => onConfigureSource?.()}>
                    {t('configureDataSource', 'Configure Data Source')}
                  </Button>
                )}
                <Button kind="tertiary" onClick={() => setCreateSource(!createSource)}>
                  {createSource
                    ? t('cancelSourceCreation', 'Cancel source creation')
                    : t('createDataSource', 'Create data source')}
                </Button>
                {createSource && (
                  <DataSourceBuilder
                    key={widget.id}
                    widget={widget}
                    definition={definition}
                    onSave={(next, key) => {
                      onCreateSource(next, key);
                      setCreateSource(false);
                    }}
                  />
                )}
              </>
            ) : (
              <p>{t('noClinicalSourceRequired', 'This widget does not require a clinical data source.')}</p>
            )}
          </Stack>
        </TabPanel>
        <TabPanel>
          <Stack gap={5}>
            {widget.type === 'metric' && (
              <>
                <Checkbox
                  id="metric-show-date"
                  labelText={t('showDate', 'Show observation date')}
                  checked={widget.properties?.showDate !== false}
                  onChange={(_, { checked }) => property('showDate', checked)}
                />
                <StatusMappingsEditor widget={widget} definition={definition} onChange={onWidgetChange} />
              </>
            )}
            {manifest?.configurable.includes('unit') && (
              <TextInput
                id="widget-unit"
                labelText={t('units', 'Units')}
                maxLength={20}
                value={String(widget.properties?.unit ?? '')}
                onChange={(event) => property('unit', event.target.value)}
              />
            )}
            {manifest?.configurable.includes('decimals') && (
              <>
                <NumberInput
                  id="widget-decimals"
                  label={t('decimalPlaces', 'Decimal places')}
                  min={0}
                  max={4}
                  value={Number(widget.properties?.precision ?? widget.properties?.decimals ?? 0)}
                  onChange={(_, { value }) => {
                    const n = Number(value);
                    if (Number.isInteger(n) && n >= 0 && n <= 4) property('precision', n);
                  }}
                />
                <Checkbox
                  id="show-target-status"
                  labelText={t('showConfiguredReference', 'Show configured reference')}
                  checked={widget.properties?.showStatus === true}
                  onChange={(_, { checked }) => property('showStatus', checked)}
                />
                {(['targetMin', 'targetMax'] as const).map((key) => (
                  <TextInput
                    key={key}
                    id={`widget-${key}`}
                    type="number"
                    labelText={
                      key === 'targetMin'
                        ? t('targetMinimum', 'Target minimum (optional)')
                        : t('targetMaximum', 'Target maximum (optional)')
                    }
                    value={widget.properties?.[key] === undefined ? '' : String(widget.properties[key])}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === '' || Number.isFinite(Number(value)))
                        property(key, value === '' ? undefined : Number(value));
                    }}
                  />
                ))}
              </>
            )}
            {(widget.type === 'trend-chart' || widget.type === 'clinical-table') && (
              <TextInput
                id="widget-view-all-label"
                labelText={t('viewAllLabel', 'Header link label (e.g. "View all results")')}
                maxLength={1000}
                value={String(widget.properties?.viewAllLabel ?? '')}
                onChange={(event) => property('viewAllLabel', event.target.value || undefined)}
              />
            )}
            {widget.type === 'trend-chart' && (
              <>
                <Select
                  id="chart-type"
                  labelText={t('chartType', 'Chart type')}
                  value={String(widget.properties?.chartType ?? 'line')}
                  onChange={(event) => property('chartType', event.target.value)}>
                  <SelectItem value="line" text={t('lineChart', 'Line chart')} />
                  <SelectItem value="bar" text={t('barChart', 'Bar chart')} />
                </Select>
                <Select
                  id="chart-scale"
                  labelText={t('chartScale', 'Y-axis scale')}
                  value={String(widget.properties?.scaleType ?? 'linear')}
                  onChange={(event) => property('scaleType', event.target.value)}>
                  <SelectItem value="linear" text={t('linearScale', 'Linear')} />
                  <SelectItem value="log" text={t('logScale', 'Logarithmic (positive values only)')} />
                </Select>
                <Checkbox
                  id="show-data-table"
                  labelText={t('showDataTable', 'Show data table')}
                  checked={widget.properties?.showDataTable === true}
                  onChange={(_, { checked }) => property('showDataTable', checked)}
                />
              </>
            )}
            {(manifest?.data || widget.type === 'care-plan') && (
              <TextInput
                id="widget-empty-text"
                labelText={t('emptyStateText', 'Empty-state text')}
                value={String(widget.properties?.emptyText ?? '')}
                onChange={(event) => property('emptyText', event.target.value)}
              />
            )}
            {widget.type === 'clinical-table' &&
              definition.dataSources[widget.dataSource ?? '']?.resultType === 'TABLE' && (
                <InlineNotification
                  kind="info"
                  hideCloseButton
                  title={t(
                    'typedTableColumnsReadOnly',
                    'This backend supports typed record tables with automatic columns. Custom typed columns require a backend schema update.',
                  )}
                />
              )}
            {widget.type === 'clinical-table' &&
              definition.dataSources[widget.dataSource ?? '']?.resultType !== 'TABLE' && (
                <Stack gap={4}>
                  <h5>{t('tableColumns', 'Observation columns')}</h5>
                  {fieldsForSource(definition.dataSources[widget.dataSource ?? '']).map((field) => {
                    const columns = (widget.properties?.columns ??
                      (definition.dataSources[widget.dataSource ?? '']?.resultType === 'TABLE'
                        ? fieldsForSource(definition.dataSources[widget.dataSource ?? ''])
                            .slice(0, 6)
                            .map((field) => ({ field, label: t(`recordField.${field}`, field) }))
                        : [
                            { field: 'value', label: t('value', 'Value') },
                            { field: 'effectiveTime', label: t('date', 'Date') },
                          ])) as Array<{ field: string; label: string }>;
                    const column = columns.find((item) => item.field === field);
                    return (
                      <div key={field}>
                        <Checkbox
                          id={`column-${field}`}
                          labelText={t(`observationField.${field}`, field)}
                          checked={Boolean(column)}
                          disabled={(Boolean(column) && columns.length === 1) || (!column && columns.length >= 4)}
                          onChange={(_, { checked }) =>
                            property(
                              'columns',
                              checked
                                ? [...columns, { field, label: t(`observationField.${field}`, field) }]
                                : columns.filter((item) => item.field !== field),
                            )
                          }
                        />
                        {column && (
                          <TextInput
                            id={`column-label-${field}`}
                            labelText={t('columnLabel', 'Column label: {{field}}', { field })}
                            value={column.label}
                            maxLength={100}
                            onChange={(event) =>
                              property(
                                'columns',
                                columns.map((item) =>
                                  item.field === field ? { ...item, label: event.target.value } : item,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                  <Select
                    id="table-sort-field"
                    labelText={t('defaultSortField', 'Default sort field')}
                    value={String(widget.properties?.sortBy ?? 'effectiveTime')}
                    onChange={(event) => property('sortBy', event.target.value)}>
                    {fieldsForSource(definition.dataSources[widget.dataSource ?? '']).map((field) => (
                      <SelectItem key={field} value={field} text={t(`observationField.${field}`, field)} />
                    ))}
                  </Select>
                </Stack>
              )}
            {['clinical-table', 'timeline'].includes(widget.type) && (
              <Select
                id="records-sort-order"
                labelText={t('sortOrder', 'Sort order')}
                value={String(widget.properties?.sortOrder ?? 'desc')}
                onChange={(event) => property('sortOrder', event.target.value)}>
                <SelectItem value="desc" text={t('descending', 'Descending')} />
                <SelectItem value="asc" text={t('ascending', 'Ascending')} />
              </Select>
            )}
            {widget.type === 'clinical-table' &&
              definition.dataSources[widget.dataSource ?? '']?.resultType === 'TABLE' && (
                <InlineNotification
                  kind="info"
                  hideCloseButton
                  title={t(
                    'typedTableColumnsReadOnly',
                    'This backend supports typed record tables with automatic columns. Custom typed columns require a backend schema update.',
                  )}
                />
              )}
            {widget.type === 'clinical-table' &&
              definition.dataSources[widget.dataSource ?? '']?.resultType !== 'TABLE' && (
                <NumberInput
                  id="widget-page-size"
                  label={t('tablePageSize', 'Table page size')}
                  min={5}
                  max={50}
                  value={Number(widget.properties?.pageSize ?? 5)}
                  onChange={(_, { value }) => {
                    const n = Number(value);
                    if (Number.isInteger(n) && n >= 5 && n <= 50) property('pageSize', n);
                  }}
                />
              )}
            {setWidgetTypes.includes(widget.type) && (
              <SetWidgetDisplay widget={widget} onWidgetChange={onWidgetChange} />
            )}
            {widget.type === 'notes-list' && (
              <>
                <NumberInput
                  id="notes-max-visible"
                  label={t('visibleNotes', 'Most recent notes to show')}
                  min={1}
                  max={50}
                  value={Number(widget.properties?.maxVisible ?? 5)}
                  onChange={(_, { value }) => {
                    const n = Number(value);
                    if (Number.isInteger(n) && n >= 1 && n <= 50) property('maxVisible', n);
                  }}
                />
                <Checkbox
                  id="notes-show-preview"
                  labelText={t('showPreview', 'Preview note text in the header')}
                  checked={widget.properties?.showPreview !== false}
                  onChange={(_, { checked }) => property('showPreview', checked)}
                />
              </>
            )}
            <Select
              id="loading-policy"
              labelText={t('loadingPolicy', 'Loading policy')}
              value={widget.loadingPolicy ?? 'ON_VISIBLE'}
              onChange={(event) =>
                onWidgetChange({ ...widget, loadingPolicy: event.target.value as WidgetInstance['loadingPolicy'] })
              }>
              <SelectItem value="ON_VISIBLE" text={t('onVisible', 'When visible')} />
              <SelectItem value="EAGER" text={t('eager', 'When section opens')} />
            </Select>
            <p>
              {t(
                'responsiveLayoutHint',
                'Dimensions apply to the selected wide or narrow layout. Narrow patient screens stack widgets.',
              )}
            </p>
            {(['row', 'col', 'w', 'h'] as const).map((key) => (
              <NumberInput
                key={`${widget.id}-${size}-${key}`}
                id={`position-${key}`}
                label={t(`grid.${key}`, { row: 'Row', col: 'Column', w: 'Width', h: 'Height' }[key])}
                min={key === 'row' ? 0 : 1}
                max={key === 'row' ? 100 : key === 'h' ? 20 : 12}
                value={position[key]}
                onChange={(_, { value }) => {
                  const n = Number(value);
                  if (
                    Number.isInteger(n) &&
                    n >= (key === 'row' ? 0 : 1) &&
                    n <= (key === 'row' ? 100 : key === 'h' ? 20 : 12)
                  )
                    onPositionChange(key, n);
                }}
              />
            ))}
          </Stack>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}

/**
 * Member display selection for grouped-set widgets: rows come from the source's declared
 * members (set order); table inclusion, numeric-only chart inclusion and order are widget
 * properties. A configured member that is no longer declared by the source raises a validation
 * issue instead of being silently replaced.
 */
function SetWidgetMembers({
  widget,
  definition,
  onWidgetChange,
}: {
  widget: WidgetInstance;
  definition: ModelDefinition;
  onWidgetChange: (widget: WidgetInstance) => void;
}) {
  const { t } = useTranslation();
  const source = definition.dataSources[widget.dataSource ?? ''];
  const conceptUuid = source?.conceptAlias ? definition.terminology.concepts?.[source.conceptAlias] : undefined;
  const { data: details } = useSWR(
    conceptUuid ? ['caremodels-concept-set', conceptUuid] : null,
    ([, uuid]: [string, string]) => fetchConceptSetDetails(uuid),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateIfStale: false, keepPreviousData: true },
  );
  const setMembers = details?.setMembers ?? [];
  const configs = configuredMembers(widget.properties);
  useEffect(() => {
    if (!details || configs.length || !setMembers.length) return;
    const declared = source?.members?.length ? source.members : setMembers.map((member) => member.uuid);
    onWidgetChange({
      ...widget,
      properties: {
        ...widget.properties,
        members: declared
          .filter((uuid) => setMembers.some((member) => member.uuid === uuid))
          .map((uuid) => {
            const member = setMembers.find((item) => item.uuid === uuid)!;
            return {
              conceptUuid: uuid,
              label: member.display,
              inTable: true,
              inChart: (member.datatype?.display ?? '').toLowerCase() === 'numeric',
            };
          }),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);
  const property = (key: string, value: unknown) =>
    onWidgetChange({ ...widget, properties: { ...widget.properties, [key]: value } });
  const updateConfigs = (next: Array<{ conceptUuid: string; label: string; inTable: boolean; inChart?: boolean }>) =>
    property('members', next.length ? next : undefined);
  const isNumeric = (uuid: string) =>
    (setMembers.find((member) => member.uuid === uuid)?.datatype?.display ?? '').toLowerCase() === 'numeric';
  const unknown = configs.filter((config) => setMembers.length && !setMembers.some((member) => member.uuid === config.conceptUuid));
  const unconfigured = setMembers.filter((member) => !configs.some((config) => config.conceptUuid === member.uuid));
  return (
    <Stack gap={4}>
      <p className={styles.inlineFieldLabel}>{t('membersToDisplay', 'Members to display')}</p>
      {unknown.length > 0 && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={t(
            'staleMemberSelection',
            '{{count}} configured member(s) are no longer declared by the data source. Remove them to resolve this issue.',
            { count: unknown.length },
          )}
        />
      )}
      <ul className={styles.memberConfigList}>
        {configs.map((config, index) => (
          <li key={config.conceptUuid}>
            <span className={unknown.some((stale) => stale.conceptUuid === config.conceptUuid) ? styles.staleMember : undefined}>
              {config.label}
            </span>
            <Checkbox
              id={`table-${config.conceptUuid}`}
              labelText={t('inTable', 'Table')}
              checked={config.inTable}
              onChange={(_, { checked }) =>
                updateConfigs(configs.map((item, i) => (i === index ? { ...item, inTable: checked } : item)))
              }
            />
            <Checkbox
              id={`chart-${config.conceptUuid}`}
              labelText={t('inChart', 'Chart')}
              checked={config.inChart === true}
              disabled={!isNumeric(config.conceptUuid) && config.inChart !== true}
              title={isNumeric(config.conceptUuid) ? undefined : t('numericOnly', 'Only numeric members can be charted')}
              onChange={(_, { checked }) =>
                updateConfigs(configs.map((item, i) => (i === index ? { ...item, inChart: checked } : item)))
              }
            />
            <MoveUpDown
              onUp={() =>
                index > 0 &&
                updateConfigs([...configs.slice(0, index - 1), configs[index], configs[index - 1], ...configs.slice(index + 1)])
              }
              onDown={() =>
                index < configs.length - 1 &&
                updateConfigs([...configs.slice(0, index), configs[index + 1], configs[index], ...configs.slice(index + 2)])
              }
              onRemove={() => updateConfigs(configs.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      {unconfigured.length > 0 && (
        <Select
          id="add-set-member"
          labelText={t('addMember', 'Add member')}
          value=""
          onChange={(event) => {
            const uuid = event.target.value;
            const member = setMembers.find((item) => item.uuid === uuid);
            if (member)
              updateConfigs([
                ...configs,
                {
                  conceptUuid: uuid,
                  label: member.display,
                  inTable: true,
                  inChart: (member.datatype?.display ?? '').toLowerCase() === 'numeric',
                },
              ]);
          }}>
          <SelectItem value="" text={t('selectMemberToAdd', 'Select a member to add')} />
          {unconfigured.map((member) => (
            <SelectItem key={member.uuid} value={member.uuid} text={member.display} />
          ))}
        </Select>
      )}
    </Stack>
  );
}

/** Display properties for the two grouped-set widgets. */
function SetWidgetDisplay({
  widget,
  onWidgetChange,
}: {
  widget: WidgetInstance;
  onWidgetChange: (widget: WidgetInstance) => void;
}) {
  const { t } = useTranslation();
  const history = widget.type === 'set-history-trends';
  const property = (key: string, value: unknown) =>
    onWidgetChange({ ...widget, properties: { ...widget.properties, [key]: value } });
  const toggle = (key: string, label: string, checked: boolean) => (
    <Checkbox
      key={key}
      id={`set-${key}`}
      labelText={label}
      checked={checked}
      onChange={(_, { checked: next }) => property(key, next)}
    />
  );
  return (
    <Stack gap={4}>
      {history && (
        <Select
          id="set-default-view"
          labelText={t('defaultView', 'Default view')}
          value={String(widget.properties?.defaultView ?? 'chart')}
          onChange={(event) => property('defaultView', event.target.value)}>
          <SelectItem value="chart" text={t('chart', 'Chart')} />
          <SelectItem value="table" text={t('table', 'Table')} />
        </Select>
      )}
      {history && (
        <Select
          id="set-default-range"
          labelText={t('defaultRange', 'Default date range')}
          value={String(widget.properties?.defaultRange ?? '2y')}
          onChange={(event) => property('defaultRange', event.target.value)}>
          <SelectItem value="6m" text={t('range6m', 'Last 6 months')} />
          <SelectItem value="1y" text={t('range1y', 'Last year')} />
          <SelectItem value="2y" text={t('range2y', 'Last 2 years')} />
          <SelectItem value="5y" text={t('range5y', 'Last 5 years')} />
          <SelectItem value="all" text={t('rangeAll', 'All recorded')} />
        </Select>
      )}
      {history && (
        <Select
          id="set-chart-layout"
          labelText={t('chartLayout', 'Numeric chart series')}
          value={String(widget.properties?.chartLayout ?? 'panels')}
          onChange={(event) => property('chartLayout', event.target.value)}>
          <SelectItem value="panels" text={t('layoutPanels', 'Separate panels per unit')} />
          <SelectItem value="combined" text={t('layoutCombined', 'Combined (matching units only)')} />
        </Select>
      )}
      {history && (
        <NumberInput
          id="set-rows-per-page"
          label={t('rowsPerPage', 'Rows per page')}
          min={5}
          max={50}
          value={Number(widget.properties?.rowsPerPage ?? 5)}
          onChange={(_, { value }) => {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 5 && n <= 50) property('rowsPerPage', n);
          }}
        />
      )}
      {widget.type === 'latest-set-results' && (
        <Select
          id="set-density"
          labelText={t('displayDensity', 'Display density')}
          value={String(widget.properties?.density ?? 'compact')}
          onChange={(event) => property('density', event.target.value)}>
          <SelectItem value="compact" text={t('compact', 'Compact')} />
          <SelectItem value="regular" text={t('regular', 'Regular')} />
        </Select>
      )}
      {widget.type === 'latest-set-results' && (
        <NumberInput
          id="set-max-visible"
          label={t('maxVisibleMembers', 'Maximum visible members')}
          min={1}
          max={50}
          value={Number(widget.properties?.maxVisible ?? 12)}
          onChange={(_, { value }) => {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 1 && n <= 50) property('maxVisible', n);
          }}
        />
      )}
      {toggle('showDate', t('showObservationDate', 'Show observation date'), widget.properties?.showDate !== false)}
      {toggle('showUnits', t('showUnits', 'Show units'), widget.properties?.showUnits !== false)}
      {toggle(
        'showReferenceRange',
        t('showReferenceRanges', 'Show reference ranges when available'),
        widget.properties?.showReferenceRange === true,
      )}
      {toggle('showMissing', t('showMissingMembers', 'Show missing members'), widget.properties?.showMissing !== false)}
    </Stack>
  );
}
