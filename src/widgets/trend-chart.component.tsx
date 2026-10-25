import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InlineNotification, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { DataResult, WidgetInstance } from '../types/caremodels';
import '@carbon/charts/styles.css';
import { WidgetDataState } from './widget-data-state.component';
import { formatClinicalDate, formatClinicalValue } from './clinical-format';
import styles from './widgets.scss';

export function chartPoints(data?: DataResult, logarithmic = false) {
  return (data?.values ?? [])
    .flatMap((value) => {
      const time = value.effectiveTime ? Date.parse(value.effectiveTime) : NaN;
      return value.valueType === 'NUMBER' &&
        typeof value.value === 'number' &&
        Number.isFinite(value.value) &&
        (!logarithmic || value.value > 0) &&
        Number.isFinite(time)
        ? [
            {
              time,
              value: value.value,
              obsUuid: value.obsUuid,
              group: (value as typeof value & { series?: string }).series,
            },
          ]
        : [];
    })
    .sort((a, b) => a.time - b.time || (a.obsUuid < b.obsUuid ? -1 : a.obsUuid > b.obsUuid ? 1 : 0));
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
  const { data, error, isLoading, retry } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);
  if (widget.dataSources?.length)
    return <MultiTrendChart widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
  return <TrendChartView widget={widget} data={data} error={error} isLoading={isLoading} onRetry={retry} />;
}

function TrendChartView({
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
  const logarithmic = widget.properties?.scaleType === 'log';
  const points = useMemo(() => chartPoints(data, logarithmic), [data, logarithmic]);
  const excluded = (data?.values?.length ?? 0) - points.length;
  const title = String(widget.properties?.title ?? widget.id);
  const unit = String(widget.properties?.unit ?? '');
  const viewAllLabel = String(widget.properties?.viewAllLabel ?? '');
  return (
    <div className={styles.trendChart}>
      <div className={styles.chartHeader}>
        <h4 className={styles.widgetTitle}>
          {title}
          {unit && <span className={styles.chartUnit}> ({unit})</span>}
        </h4>
        {viewAllLabel && (
          <span className={styles.viewAllLink}>
            {viewAllLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      {Boolean(widget.properties?.description) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.description)}</p>
      )}
      {error || isLoading || !data?.values?.length ? (
        <WidgetDataState
          error={error}
          isLoading={isLoading}
          data={data}
          emptyMessage={String(
            widget.properties?.emptyMessage ||
              widget.properties?.emptyText ||
              t('noChartData', 'No dated numeric measurements recorded'),
          )}
          onRetry={onRetry}
        />
      ) : (
        <>
          {excluded > 0 && (
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              title={t('excludedChartValues', 'Some results are not plotted')}
              subtitle={t(
                'excludedChartValuesHint',
                'Qualified, nonnumeric, undated, or nonpositive logarithmic results remain in the measurement table; they are not converted into exact plotted values.',
              )}
            />
          )}
          {points.length > 0 ? (
            <CarbonTrendChart
              points={points}
              title={title}
              unit={String(widget.properties?.unit ?? '')}
              chartType={widget.properties?.chartType === 'bar' ? 'bar' : 'line'}
              logarithmic={logarithmic}
            />
          ) : (
            <p>{t('noChartData', 'No dated numeric measurements recorded')}</p>
          )}
          <details open={widget.properties?.showDataTable === true || excluded > 0}>
            <summary>{t('measurementData', 'Measurement data')}</summary>
            <Table size="sm">
              <TableHead>
                <TableRow>
                  {widget.dataSources?.length && <TableHeader>{t('series', 'Series')}</TableHeader>}
                  <TableHeader>{t('date', 'Date')}</TableHeader>
                  <TableHeader>{t('value', 'Value')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.values.map((p, index) => (
                  <TableRow key={`${p.obsUuid}-${index}`}>
                    {widget.dataSources?.length && (
                      <TableCell>{(p as typeof p & { series?: string }).series}</TableCell>
                    )}
                    <TableCell>{formatClinicalDate(p.effectiveTime)}</TableCell>
                    <TableCell>{formatClinicalValue(p)}</TableCell>
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

function MultiTrendChart({
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
  const keys = widget.dataSources ?? [];
  const source0 = useWidgetData(patientUuid, modelCode, tabId, keys[0] ?? null);
  const source1 = useWidgetData(patientUuid, modelCode, tabId, keys[1] ?? null);
  const source2 = useWidgetData(patientUuid, modelCode, tabId, keys[2] ?? null);
  const source3 = useWidgetData(patientUuid, modelCode, tabId, keys[3] ?? null);
  const source4 = useWidgetData(patientUuid, modelCode, tabId, keys[4] ?? null);
  const source5 = useWidgetData(patientUuid, modelCode, tabId, keys[5] ?? null);
  const source6 = useWidgetData(patientUuid, modelCode, tabId, keys[6] ?? null);
  const source7 = useWidgetData(patientUuid, modelCode, tabId, keys[7] ?? null);
  const results = [source0, source1, source2, source3, source4, source5, source6, source7].slice(0, keys.length);
  const data = useMemo<DataResult>(
    () => ({
      type: 'combined-display',
      values: [
        source0.data,
        source1.data,
        source2.data,
        source3.data,
        source4.data,
        source5.data,
        source6.data,
        source7.data,
      ]
        .slice(0, widget.dataSources?.length ?? 0)
        .flatMap((result, index) =>
          (result?.values ?? []).map((value) => ({
            ...value,
            obsUuid: `${widget.dataSources?.[index]}:${value.obsUuid}`,
            series: widget.dataSources?.[index],
          })),
        ),
    }),
    [
      source0.data,
      source1.data,
      source2.data,
      source3.data,
      source4.data,
      source5.data,
      source6.data,
      source7.data,
      widget.dataSources,
    ],
  );
  const units = results.map((result) => (result.data as DataResult & { units?: string })?.units);
  const unsafeUnits =
    results.every((result) => Boolean(result.data)) &&
    (units.some((unit) => typeof unit !== 'string' || !unit) || new Set(units).size > 1);
  if (unsafeUnits)
    return (
      <InlineNotification
        kind="warning"
        hideCloseButton
        title={t(
          'incompatibleSeriesUnits',
          'Chart series require matching explicit units. Use separate charts for these sources.',
        )}
      />
    );
  return (
    <TrendChartView
      widget={{ ...widget, properties: { ...widget.properties, unit: units[0] ?? '' } }}
      data={data}
      error={results.find((result) => result.error)?.error}
      isLoading={results.some((result) => result.isLoading)}
      onRetry={() => Promise.all(results.map((result) => result.retry()))}
    />
  );
}

function CarbonTrendChart({
  points,
  title,
  chartType,
  unit,
  logarithmic,
}: {
  points: ReturnType<typeof chartPoints>;
  title: string;
  chartType: 'bar' | 'line';
  unit: string;
  logarithmic: boolean;
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
        // Carbon's destroy() removes the element it was given, so it must never be a
        // React-managed node: pass a scratch div inside the React-owned wrapper.
        if (cancelled || !holder.current) return;
        const scratch = document.createElement('div');
        holder.current.appendChild(scratch);
        const Chart = chartType === 'bar' ? SimpleBarChart : LineChart;
        chart = new Chart(scratch, {
          data: points.map((point) => ({
            group: point.group ?? title,
            date: new Date(point.time),
            value: point.value,
          })),
          options: {
            height: '190px',
            animations: false,
            axes: {
              bottom: { mapsTo: 'date', scaleType: ScaleTypes.TIME },
              left: { mapsTo: 'value', scaleType: logarithmic ? ScaleTypes.LOG : ScaleTypes.LINEAR, title: unit },
            },
            curve: 'curveLinear',
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
  }, [points, title, chartType, unit, logarithmic]);
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
