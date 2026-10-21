import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  InlineNotification,
  SkeletonPlaceholder,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { DataResult, WidgetInstance } from '../types/caremodels';
import '@carbon/charts/styles.css';
import styles from './widgets.scss';

export function chartPoints(data?: DataResult) {
  return (data?.values ?? [])
    .flatMap((value) => {
      const time = value.effectiveTime ? Date.parse(value.effectiveTime) : NaN;
      return value.valueType === 'NUMBER' &&
        typeof value.value === 'number' &&
        Number.isFinite(value.value) &&
        Number.isFinite(time)
        ? [{ time, value: value.value, obsUuid: value.obsUuid }]
        : [];
    })
    .sort((a, b) => a.time - b.time);
}

export function TrendChartWidget({
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
  const { data, error, isLoading } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);
  const points = useMemo(() => chartPoints(data), [data]);
  const title = String(widget.properties?.title ?? widget.id);
  return (
    <div className={styles.trendChart}>
      <h4 className={styles.widgetTitle}>{title}</h4>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      {Boolean(widget.properties?.description) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.description)}</p>
      )}
      {error ? (
        <p>{t('dataUnavailable', 'Data unavailable')}</p>
      ) : isLoading ? (
        <SkeletonPlaceholder />
      ) : !points.length ? (
        <p>{String(widget.properties?.emptyText || t('noChartData', 'No dated numeric measurements recorded'))}</p>
      ) : (
        <>
          <CarbonTrendChart
            points={points}
            title={title}
            unit={String(widget.properties?.unit ?? '')}
            chartType={widget.properties?.chartType === 'bar' ? 'bar' : 'line'}
          />
          <details open={widget.properties?.showDataTable === true}>
            <summary>{t('measurementData', 'Measurement data')}</summary>
            <Table size="sm">
              <TableHead>
                <TableRow>
                  <TableHeader>{t('date', 'Date')}</TableHeader>
                  <TableHeader>{t('value', 'Value')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {points.map((p, index) => (
                  <TableRow key={`${p.obsUuid}-${index}`}>
                    <TableCell>{new Date(p.time).toLocaleDateString()}</TableCell>
                    <TableCell>{p.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </>
      )}
    </div>
  );
}

function CarbonTrendChart({
  points,
  title,
  chartType,
  unit,
}: {
  points: ReturnType<typeof chartPoints>;
  title: string;
  chartType: 'bar' | 'line';
  unit: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();
  useEffect(() => {
    let cancelled = false;
    let chart: { destroy: () => void } | undefined;
    setFailed(false);
    // Load chart code only after a selected, visible widget has real numeric results.
    import('@carbon/charts')
      .then(({ LineChart, SimpleBarChart, ScaleTypes }) => {
        if (cancelled || !holder.current) return;
        const Chart = chartType === 'bar' ? SimpleBarChart : LineChart;
        chart = new Chart(holder.current, {
          data: points.map((point) => ({ group: title, date: new Date(point.time), value: point.value })),
          options: {
            height: '280px',
            animations: false,
            axes: {
              bottom: { mapsTo: 'date', scaleType: ScaleTypes.TIME },
              left: { mapsTo: 'value', scaleType: ScaleTypes.LINEAR, title: unit },
            },
            legend: { enabled: true },
            toolbar: { enabled: false },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [points, title, chartType, unit]);
  return (
    <>
      <div ref={holder} className={styles.chart} aria-label={title} />
      {failed && (
        <InlineNotification
          kind="warning"
          title={t('chartUnavailable', 'Chart unavailable. Measurements remain available in the data table.')}
          hideCloseButton
        />
      )}
    </>
  );
}
