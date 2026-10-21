import React from 'react';
import { Tile, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { DataResult, WidgetInstance } from '../types/caremodels';
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
  if (error) {
    return <p className={styles.missingData}>{t('dataUnavailable', 'Data unavailable')}</p>;
  }
  if (isLoading) {
    return <p className={styles.missingData}>{t('loading', 'Loading…')}</p>;
  }
  const latest = data?.values?.[0];
  if (!latest || latest.value === undefined || latest.value === null) {
    return (
      <p className={styles.missingData}>
        {String(widget.properties?.emptyText || t('noMeasurement', 'No measurement recorded'))}
      </p>
    );
  }
  const properties = widget.properties ?? {};
  const numeric = typeof latest.value === 'number';
  const decimals =
    typeof properties.decimals === 'number' ? Math.min(4, Math.max(0, Math.round(properties.decimals))) : undefined;
  const value =
    latest.valueName ??
    (numeric && decimals !== undefined ? (latest.value as number).toFixed(decimals) : String(latest.value));
  const outside =
    numeric &&
    ((typeof properties.targetMin === 'number' && Number(latest.value) < properties.targetMin) ||
      (typeof properties.targetMax === 'number' && Number(latest.value) > properties.targetMax));
  const hasTarget = numeric && (typeof properties.targetMin === 'number' || typeof properties.targetMax === 'number');
  return (
    <>
      {properties.presentation === 'status' ? (
        <Tag type="blue">{value}</Tag>
      ) : (
        <p className={styles.metricValue}>
          {value}
          {Boolean(properties.unit) && <span className={styles.metricUnit}> {String(properties.unit)}</span>}
        </p>
      )}
      {properties.showStatus === true && hasTarget && (
        <Tag type={outside ? 'red' : 'green'}>
          {outside ? t('outsideTarget', 'Outside target') : t('withinTarget', 'Within target')}
        </Tag>
      )}
      {latest.effectiveTime && (
        <p className={styles.measurementDate}>{t('recordedAt', 'Recorded {{date}}', { date: latest.effectiveTime })}</p>
      )}
      {Boolean(properties.description) && <p className={styles.widgetSubtitle}>{String(properties.description)}</p>}
    </>
  );
}
