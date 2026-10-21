import React, { useState } from 'react';
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
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { GridPosition, ModelDefinition, WidgetInstance } from '../../types/caremodels';
import { bindWidgetSource, manifestFor, sourceCompatibility, widgetManifest } from '../../widgets/widget-registry';
import { DataSourceBuilder, SourceSettings } from './data-source-builder.component';

export function WidgetInspector({
  widget,
  definition,
  onWidgetChange,
  onDefinitionChange,
  onCreateSource,
  position,
  onPositionChange,
  size,
}: {
  widget: WidgetInstance;
  definition: ModelDefinition;
  onWidgetChange: (widget: WidgetInstance) => void;
  onDefinitionChange: (definition: ModelDefinition) => void;
  onCreateSource: (definition: ModelDefinition, key: string) => void;
  position: GridPosition;
  onPositionChange: (key: keyof GridPosition, value: number) => void;
  size: 'wide' | 'narrow';
}) {
  const { t } = useTranslation();
  const [createSource, setCreateSource] = useState(false);
  const manifest = manifestFor(widget);
  const mismatch = manifest?.data ? sourceCompatibility(widget, definition.dataSources[widget.dataSource ?? '']) : null;
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
            <TextInput
              id="inspector-title"
              labelText={t('title', 'Title')}
              value={String(widget.properties?.title ?? '')}
              onChange={(event) => property('title', event.target.value)}
            />
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
                    ...widget.properties,
                    ...next.properties,
                    presentation: next.id === 'clinical-status' ? 'status' : 'value',
                  },
                };
                if (!next.data || sourceCompatibility(updated, definition.dataSources[widget.dataSource ?? '']))
                  delete updated.dataSource;
                onWidgetChange(updated);
              }}>
              {widgetManifest.map((item) => (
                <SelectItem key={item.id} value={item.id} text={t(`widget.${item.id}`, item.label)} />
              ))}
            </Select>
            {['subtitle', 'description'].map((key) => (
              <TextInput
                key={key}
                id={`widget-${key}`}
                labelText={key === 'subtitle' ? t('subtitle', 'Subtitle') : t('description', 'Description')}
                value={String(widget.properties?.[key] ?? '')}
                onChange={(event) => property(key, event.target.value)}
              />
            ))}
            {widget.type === 'form-launcher' && (
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
                {mismatch && (
                  <InlineNotification
                    kind="warning"
                    hideCloseButton
                    title={t('incompatibleSource', 'Incompatible data source')}
                    subtitle={t(`sourceCompatibility.${mismatch}`, mismatch)}
                  />
                )}
                {widget.dataSource && (
                  <SourceSettings
                    key={widget.dataSource}
                    sourceKey={widget.dataSource}
                    definition={definition}
                    onChange={onDefinitionChange}
                  />
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
                  value={Number(widget.properties?.decimals ?? 0)}
                  onChange={(_, { value }) => {
                    const n = Number(value);
                    if (Number.isInteger(n) && n >= 0 && n <= 4) property('decimals', n);
                  }}
                />
                <Checkbox
                  id="show-target-status"
                  labelText={t('showTargetStatus', 'Show target status')}
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
                <Checkbox
                  id="show-data-table"
                  labelText={t('showDataTable', 'Show data table')}
                  checked={widget.properties?.showDataTable === true}
                  onChange={(_, { checked }) => property('showDataTable', checked)}
                />
              </>
            )}
            {manifest?.data && (
              <TextInput
                id="widget-empty-text"
                labelText={t('emptyStateText', 'Empty-state text')}
                value={String(widget.properties?.emptyText ?? '')}
                onChange={(event) => property('emptyText', event.target.value)}
              />
            )}
            {widget.type === 'clinical-table' && (
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
