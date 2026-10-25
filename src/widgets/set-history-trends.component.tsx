import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Checkbox,
  ContentSwitcher,
  InlineNotification,
  Pagination,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { ObservationGroup, WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import {
  configuredMembers,
  formatReferenceRange,
  formatSetDate,
  formatSetMemberValue,
  isNumericDatatype,
  memberValues,
  rangeCutoff,
  type SetMemberConfig,
} from './observation-set-format';
import styles from './widgets.scss';
import type * as CarbonCharts from '@carbon/charts';
/** Shared dynamic import: concurrent charts must never load the chart module twice. */
let chartsPromise: Promise<typeof CarbonCharts> | null = null;
function loadCharts() {
  chartsPromise ??= import('@carbon/charts');
  return chartsPromise;
}

/**
 * Set History & Trends: one table row per actual parent observation group; the chart plots
 * numeric member series only, never interpolates missing measurements, and splits into panels
 * when series use incompatible units. Qualitative members stay visible in the table.
 */
export function SetHistoryTrendsWidget({
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
  const { data, error, isLoading, retry } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);
  const properties = widget.properties ?? {};
  const members = useMemo(() => configuredMembers(properties), [properties]);
  const groups = useMemo(() => filterGroups(data?.groups ?? [], String(properties.defaultRange ?? 'all')), [data, properties.defaultRange]);
  const [view, setView] = useState<'chart' | 'table'>(properties.defaultView === 'table' ? 'table' : 'chart');
  const numeric = members.filter(
    (member) =>
      member.inChart !== false &&
      groups.some((group) => memberValues(group, member.conceptUuid).some((entry) => isNumericDatatype(entry.datatype))),
  );
  // A set without numeric members has no quantitative series: default to the table.
  useEffect(() => {
    if (data && !numeric.length && view === 'chart' && properties.defaultView !== 'table') setView('table');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const series = numeric.filter((member) => !excluded.has(member.conceptUuid));
  const title = String(properties.title ?? widget.id);

  return (
    <div className={styles.tableWrapper}>
      {/* Widget title sits on its own line, above the Chart/Table switcher. */}
      <h4 className={styles.widgetTitle}>{title}</h4>
      <div className={styles.chartHeader}>
        <ContentSwitcher
          size="sm"
          selectedIndex={view === 'chart' ? 0 : 1}
          onChange={({ name }) => setView(name as 'chart' | 'table')}>
          <Switch name="chart" text={t('chart', 'Chart')} />
          <Switch name="table" text={t('table', 'Table')} />
        </ContentSwitcher>
      </div>
      {Boolean(properties.subtitle) && <p className={styles.widgetSubtitle}>{String(properties.subtitle)}</p>}
      {Boolean(properties.description) && <p className={styles.widgetSubtitle}>{String(properties.description)}</p>}
      {error || isLoading || !groups.length ? (
        <WidgetDataState
          error={error}
          isLoading={isLoading}
          data={data}
          emptyMessage={String(
            properties.emptyMessage || properties.emptyText || t('noSetResults', 'No recorded group results'),
          )}
          onRetry={retry}
        />
      ) : view === 'chart' ? (
        <>
          {data?.truncated && (
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              title={t('resultsTruncated', 'Additional records exist. Increase the source limit or narrow the date window.')}
            />
          )}
          {numeric.length ? (
            <div className={styles.historyMembers}>
              {numeric.map((member) => (
                <Checkbox
                  key={member.conceptUuid}
                  id={`series-${member.conceptUuid}`}
                  labelText={member.label}
                  checked={!excluded.has(member.conceptUuid)}
                  onChange={(_, { checked }) => {
                    const next = new Set(excluded);
                    if (checked) next.delete(member.conceptUuid);
                    else next.add(member.conceptUuid);
                    setExcluded(next);
                  }}
                />
              ))}
            </div>
          ) : (
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              title={t(
                'noQuantitativeSeries',
                'No numeric members are available for a chart. Qualitative results remain in the table.',
              )}
            />
          )}
          {series.length > 0 && <HistoryChart groups={groups} members={series} layout={String(properties.chartLayout ?? 'panels')} title={title} />}
        </>
      ) : (
        <HistoryTable groups={groups} members={members} properties={properties} />
      )}
    </div>
  );
}

function filterGroups(groups: Array<ObservationGroup>, range: string): Array<ObservationGroup> {
  const cutoff = rangeCutoff(groups[0]?.effectiveDate ?? undefined, range);
  if (cutoff == null) return groups;
  return groups.filter((group) => {
    const time = group.effectiveDate ? Date.parse(group.effectiveDate) : NaN;
    return !Number.isFinite(time) || time >= cutoff;
  });
}

/** One row per recorded parent group; repeated member values are listed, never overwritten. */
function HistoryTable({
  groups,
  members,
  properties,
}: {
  groups: Array<ObservationGroup>;
  members: Array<SetMemberConfig>;
  properties: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const pageSize = Math.max(5, Math.min(50, Number(properties.rowsPerPage) || 5));
  const showUnits = properties.showUnits !== false;
  const showMissing = properties.showMissing !== false;
  const configured = members.filter((member) => member.inTable);
  // Without an explicit selection, all recorded members appear in set/display order.
  const columns = configured.length
    ? configured
    : Array.from(
        new Map(
          groups
            .flatMap((group) => group.members)
            .filter((member) => member.conceptUuid)
            .map((member) => [member.conceptUuid!, { conceptUuid: member.conceptUuid!, label: member.conceptDisplay ?? member.conceptUuid! }]),
        ).values(),
      );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(groups.length / pageSize)));
  const visible = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <>
      <TableContainer>
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>{t('date', 'Date')}</TableHeader>
              {columns.map((member) => (
                <TableHeader key={member.conceptUuid}>{member.label}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((group) => (
              <TableRow key={group.parentObsUuid}>
                <TableCell>{formatSetDate(group.effectiveDate)}</TableCell>
                {columns.map((member) => {
                  const values = memberValues(group, member.conceptUuid);
                  return (
                    <TableCell key={member.conceptUuid}>
                      {values.length ? (
                        values.map((entry, index) => (
                          <div key={entry.obsUuid}>
                            {formatSetMemberValue(entry)}
                            {showUnits && entry.unit ? <span className={styles.tableUnit}> {entry.unit}</span> : null}
                            {properties.showReferenceRange === true && index === 0 && formatReferenceRange(entry.referenceRange) ? (
                              <span className={styles.tableUnit}> ({formatReferenceRange(entry.referenceRange)})</span>
                            ) : null}
                          </div>
                        ))
                      ) : showMissing ? (
                        <span className={styles.missingValue}>—</span>
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {groups.length > pageSize && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          pageSizes={[pageSize]}
          totalItems={groups.length}
          itemsPerPageText={t('itemsPerPage', 'Items per page:')}
          onChange={({ page: nextPage }) => setPage(nextPage)}
        />
      )}
    </>
  );
}

/**
 * Numeric-only line chart. Series with distinct units get their own panels: values are never
 * forced onto one axis, and only actual observation dates are plotted (no interpolation).
 */
function HistoryChart({
  groups,
  members,
  layout,
  title,
}: {
  groups: Array<ObservationGroup>;
  members: Array<SetMemberConfig>;
  layout: string;
  title: string;
}) {
  const { t } = useTranslation();
  const series = members.map((member) => ({
    ...member,
    units: Array.from(
      new Set(
        groups.flatMap((group) =>
          memberValues(group, member.conceptUuid)
            .filter((entry) => isNumericDatatype(entry.datatype))
            .map((entry) => entry.unit ?? ''),
        ),
      ),
    ),
    points: groups
      .flatMap((group) =>
        memberValues(group, member.conceptUuid)
          .filter((entry) => isNumericDatatype(entry.datatype) && typeof entry.value === 'number')
          .map((entry) => ({
            time: Date.parse(entry.effectiveTime ?? group.effectiveDate ?? ''),
            value: entry.value as number,
            member,
          })),
      )
      .filter((point) => Number.isFinite(point.time))
      .sort((a, b) => a.time - b.time),
  }));
  const incompatible = series.some((entry) => entry.units.length > 1) || new Set(series.map((entry) => entry.units[0])).size > 1;
  if (layout !== 'combined' || incompatible) {
    return (
      <>
        {incompatible && (
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={t('separateChartPanels', 'Series use different units; each is plotted on its own panel.')}
          />
        )}
        {series.map((entry) => (
          <div key={entry.conceptUuid}>
            <p className={styles.widgetSubtitle}>
              {entry.label}
              {entry.units.filter(Boolean).length ? ` (${entry.units.filter(Boolean).join(', ')})` : ''}
            </p>
            <NumericLineChart
              points={entry.points}
              groupLabel={`${entry.label}${entry.units.filter(Boolean).length ? ` (${entry.units.filter(Boolean).join(', ')})` : ''}`}
              title={title}
            />
          </div>
        ))}
      </>
    );
  }
  return (
    <NumericLineChart
      points={series.flatMap((entry) => entry.points)}
      groupLabel={undefined}
      title={title}
    />
  );
}

function NumericLineChart({
  points,
  groupLabel,
  title,
}: {
  points: Array<{ time: number; value: number; member: SetMemberConfig }>;
  groupLabel?: string;
  title: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();
  useEffect(() => {
    let cancelled = false;
    let chart: { destroy: () => void } | undefined;
    setFailed(false);
    if (!points.length) return;
    loadCharts()
      .then(({ LineChart, ScaleTypes }) => {
        // Carbon's destroy() removes the element it was given, so it must never be a
        // React-managed node: pass a scratch div inside the React-owned wrapper.
        if (cancelled || !holder.current) return;
        const scratch = document.createElement('div');
        holder.current.appendChild(scratch);
        chart = new LineChart(scratch, {
          data: points.map((point) => ({
            group: groupLabel ?? `${point.member.label}`,
            date: new Date(point.time),
            value: point.value,
          })),
          options: {
            height: '190px',
            animations: false,
            axes: {
              bottom: { mapsTo: 'date', scaleType: ScaleTypes.TIME },
              left: { mapsTo: 'value', scaleType: ScaleTypes.LINEAR },
            },
            curve: 'curveLinear',
            legend: { enabled: !groupLabel },
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
  }, [points, groupLabel, title]);
  return (
    <>
      <div ref={holder} className={styles.chart} aria-label={title} />
      {failed && (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title={t('chartUnavailable', 'Chart unavailable. Results remain available in the table.')}
        />
      )}
    </>
  );
}
