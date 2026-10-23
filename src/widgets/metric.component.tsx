import React from 'react';
import { Tile, Tag } from '@carbon/react';
import { Calendar, Document } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { DataResult, WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import { formatClinicalValue, formatClinicalDate } from './clinical-format';
import type { StatusMapping } from './widget-properties';
import styles from './widgets.scss';

/** Presentation profiles of the shared metric contract: value, status, date and key-value. */
type MetricPresentation = 'value' | 'status' | 'date' | 'key-value';

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
  const title = (widget.properties?.title as string) ?? widget.id;
  const { data, error, isLoading, retry } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);
  const latest = data?.values?.[0];
  const presentation = widget.properties?.presentation as MetricPresentation | undefined;
  const statusMapping = (widget.properties?.statusMappings as Array<StatusMapping> | undefined)?.find(
    (item) => item.value === String(latest?.value),
  );

  return (
    <Tile className={styles.metricTile}>
      <div className={styles.metricHeader}>
        <p className={styles.widgetTitle}>{title}</p>
        {widget.properties?.showStatus === true && statusMapping && presentation !== 'status' && (
          <Tag type={statusMapping.tone} size="sm">
            {statusMapping.label}
          </Tag>
        )}
      </div>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      <div className={styles.metricBody}>
        {presentation === 'status' ? (
          <span
            aria-hidden="true"
            className={`${styles.statusDot} ${styles[`statusDot${statusMapping?.tone ?? 'gray'}`]}`}
          />
        ) : presentation === 'date' ? (
          <Calendar className={styles.metricIcon} aria-hidden="true" />
        ) : presentation === 'key-value' ? null : (
          <Document className={styles.metricIcon} aria-hidden="true" />
        )}
        <div className={styles.metricDetail}>
          <MetricValue widget={widget} data={data} error={error} isLoading={isLoading} onRetry={retry} />
        </div>
      </div>
    </Tile>
  );
}

function MetricValue({
  widget,
  data,
  error,
  isLoading,
  onRetry,
}: {
  widget: WidgetInstance;
  data?: DataResult;
  error?: unknown;
  isLoading: boolean;
  onRetry?: () => void;
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
        onRetry={onRetry}
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
        <p className={styles.metricValue}>{mapping?.label ?? value}</p>
      ) : (
        <p className={styles.metricValue}>
          {value}
          {Boolean(properties.unit) && <span className={styles.metricUnit}> {String(properties.unit)}</span>}
        </p>
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
        <p className={styles.measurementDate}>{formatClinicalDate(latest.effectiveTime)}</p>
      )}
      {Boolean(properties.description) && <p className={styles.widgetSubtitle}>{String(properties.description)}</p>}
    </>
  );
}
