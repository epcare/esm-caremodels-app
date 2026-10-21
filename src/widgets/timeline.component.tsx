import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import { formatClinicalDate, formatClinicalValue, sortedObservations } from './clinical-format';
import styles from './widgets.scss';

/**
 * Timeline over an encounter/episode-shaped data source. Renders as a simple chronological list
 * until episode history endpoints land with the enrollment engine.
 */
export function TimelineWidget({
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

  const records = data?.type === 'encounter-query' ? (data.records ?? []) : [];
  const values = sortedObservations(data?.values ?? [], widget.properties?.sortOrder !== 'asc');

  return (
    <div className={styles.timeline}>
      <p className={styles.widgetTitle}>{title}</p>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      {Boolean(widget.properties?.description) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.description)}</p>
      )}
      {error || isLoading || (!data?.values?.length && !records.length) ? (
        <WidgetDataState
          error={error}
          isLoading={isLoading}
          data={data}
          emptyMessage={String(
            widget.properties?.emptyMessage || widget.properties?.emptyText || t('noEvents', 'No events recorded'),
          )}
        />
      ) : (
        <ol className={styles.trendList} aria-label={t('recordedObservations', 'Recorded observations')}>
          {records.map((record) => (
            <li key={record.uuid} className={styles.trendPoint}>
              <span className={styles.trendTime}>{formatClinicalDate(String(record.effectiveTime ?? ''))}</span>
              <span className={styles.trendValue}>
                {String(record.encounterTypeName ?? '')} · {String(record.status ?? '')}
              </span>
            </li>
          ))}
          {values.map((value) => (
            <li key={value.obsUuid ?? value.effectiveTime} className={styles.trendPoint}>
              <span className={styles.trendTime}>{formatClinicalDate(value.effectiveTime)}</span>
              <span className={styles.trendValue}>{formatClinicalValue(value)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
