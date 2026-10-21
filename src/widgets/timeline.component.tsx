import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { WidgetInstance } from '../types/caremodels';
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

  const values = data?.values ?? [];

  return (
    <div className={styles.timeline}>
      <p className={styles.widgetTitle}>{title}</p>
      {error ? (
        <p className={styles.missingData}>{t('dataUnavailable', 'Data unavailable')}</p>
      ) : isLoading ? (
        <p className={styles.missingData}>{t('loading', 'Loading…')}</p>
      ) : values.length === 0 ? (
        <p className={styles.missingData}>{t('noEvents', 'No events recorded')}</p>
      ) : (
        <ol className={styles.trendList}>
          {values.map((value) => (
            <li key={value.obsUuid ?? value.effectiveTime} className={styles.trendPoint}>
              <span className={styles.trendTime}>{value.effectiveTime ?? '—'}</span>
              <span className={styles.trendValue}>{value.valueName ?? value.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
