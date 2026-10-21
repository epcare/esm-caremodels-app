import React from 'react';
import { Tile } from '@carbon/react';
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
      <MetricValue data={data} error={error} isLoading={isLoading} />
    </Tile>
  );
}

function MetricValue({ data, error, isLoading }: { data?: DataResult; error?: unknown; isLoading: boolean }) {
  const { t } = useTranslation();
  if (error) {
    return <p className={styles.missingData}>{t('dataUnavailable', 'Data unavailable')}</p>;
  }
  if (isLoading) {
    return <p className={styles.missingData}>{t('loading', 'Loading…')}</p>;
  }
  const latest = data?.values?.[0];
  if (!latest || latest.value === undefined || latest.value === null) {
    return <p className={styles.missingData}>{t('noMeasurement', 'No measurement recorded')}</p>;
  }
  const suffix = latest.valueName ? ` (${latest.valueName})` : '';
  return (
    <p className={styles.metricValue}>
      {String(latest.value)}
      {suffix}
    </p>
  );
}
