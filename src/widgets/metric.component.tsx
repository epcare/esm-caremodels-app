import React from 'react';
import { Tile, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { DataResult, WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import { formatClinicalValue, formatClinicalDate } from './clinical-format';
import type { StatusMapping } from './widget-properties';
import styles from './widgets.scss';

/**
 * Metric tile: latest single value from the widget's data source. Loads only when visible
 * (ON_VISIBLE default) and only for its own declared data source.
 */
export function MetricWidget({
  widget,
  patientUuid,
  modelCode,
  tabId,
}: {
  widget: WidgetInstance;
  patientUuid: string;
  modelCode: string;
  tabId: string;
}) {
  const { t } = useTranslation();
  const title = (widget.properties?.title as string) ?? widget.id;
  const { data, error, isLoading } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);

  return (
    <Tile className={styles.metricTile}>
      <p className={styles.widgetTitle}>{title}</p>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      <MetricValue widget={widget} data={data} error={error} isLoading={isLoading} />
    </Tile>
  );
}

function MetricValue({
  widget,
  data,
  error,
  isLoading,
}: {
  widget: WidgetInstance;
  data?: DataResult;
  error?: unknown;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  if (error || isLoading || !data?.values?.length)
    return (
      <WidgetDataState
        error={error}
        isLoading={isLoading}
        data={data}
        emptyMessage={String(
          widget.properties?.emptyMessage ||
            widget.properties?.emptyText ||
            t('noMeasurement', 'No measurement recorded'),
        )}
      />
    );
  const latest = data.values[0];
  if (latest.value == null)
    return (
      <p>
        {String(
          widget.properties?.emptyMessage ||
            widget.properties?.emptyText ||
            t('noMeasurement', 'No measurement recorded'),
        )}
      </p>
    );
  const properties = widget.properties ?? {};
  const precision = (properties.precision ?? properties.decimals) as number | undefined;
  const value = formatClinicalValue(latest, precision);
  const mapping = (properties.statusMappings as Array<StatusMapping> | undefined)?.find(
    (item) => item.value === String(latest.value),
  );
  return (
    <>
      {properties.presentation === 'status' ? (
        <Tag type={mapping?.tone ?? 'blue'}>{mapping?.label ?? value}</Tag>
      ) : (
        <p className={styles.metricValue}>
          {value}
          {Boolean(properties.unit) && <span className={styles.metricUnit}> {String(properties.unit)}</span>}
        </p>
      )}
      {properties.showStatus === true && mapping && properties.presentation !== 'status' && (
        <Tag type={mapping.tone}>{mapping.label}</Tag>
      )}
      {properties.showStatus === true &&
        !mapping &&
        (properties.targetMin !== undefined || properties.targetMax !== undefined) && (
          <p className={styles.widgetSubtitle}>
            {t('configuredReference', 'Configured reference: {{minimum}} – {{maximum}}', {
              minimum: properties.targetMin ?? '—',
              maximum: properties.targetMax ?? '—',
            })}
          </p>
        )}
      {properties.showDate !== false && latest.effectiveTime && (
        <p className={styles.measurementDate}>
          {t('recordedAt', 'Recorded {{date}}', { date: formatClinicalDate(latest.effectiveTime) })}
        </p>
      )}
      {Boolean(properties.description) && <p className={styles.widgetSubtitle}>{String(properties.description)}</p>}
    </>
  );
}
