import React, { useState } from 'react';
import {
  DataTable,
  Pagination,
  Tag,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import type { ObservationField } from './widget-properties';
import type { TFunction } from 'i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import { formatClinicalDate, formatClinicalValue, sortedObservations } from './clinical-format';
import styles from './widgets.scss';

/**
 * Clinical table: renders the values list of the widget's data source with provenance columns.
 */
export function ClinicalTableWidget({
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
  const { data, error, isLoading, retry } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);

  const [page, setPage] = useState(1);
  const pageSize = Math.max(5, Math.min(50, Number(widget.properties?.pageSize) || 5));
  const values = sortedObservations(
    data?.values ?? [],
    widget.properties?.sortOrder !== 'asc',
    (widget.properties?.sortBy as ObservationField | undefined) ?? 'effectiveTime',
  );
  const observationRows = values.map((value, index) => ({
    id: value.obsUuid ?? String(index),
    value: formatClinicalValue(value),
    valueType: value.valueType,
    obsUuid: value.obsUuid,
    effectiveTime: formatClinicalDate(value.effectiveTime),
  }));

  const allowed = (data?.availableFields ?? []).filter((field) => field !== 'currentStates');
  const recordColumns =
    (widget.properties?.columns as Array<{ field: string; label: string }> | undefined) ??
    allowed.slice(0, 6).map((field) => ({ field, label: t(`recordField.${field}`, field) }));
  const columns = data?.records ? recordColumns : undefined;
  const cellValue = (field: string, value: unknown) =>
    value == null
      ? ''
      : typeof value === 'boolean'
        ? value
          ? t('yes', 'Yes')
          : t('no', 'No')
        : typeof value === 'string' || typeof value === 'number'
          ? /Date$|Time$|dateActivated/.test(field)
            ? formatClinicalDate(String(value))
            : String(value)
          : '';
  const rows = data?.records
    ? [...data.records]
        .sort((a, b) => {
          const field = String(widget.properties?.sortBy ?? 'effectiveTime');
          const x = a[field],
            y = b[field];
          if (!allowed.includes(field)) return 0;
          const comparison =
            typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
          return (widget.properties?.sortOrder === 'asc' ? comparison : -comparison) || a.uuid.localeCompare(b.uuid);
        })
        .map((record) => ({
          id: record.uuid,
          ...Object.fromEntries(recordColumns.map(({ field }) => [field, cellValue(field, record[field])])),
        }))
    : observationRows;
  const invalidColumns = Boolean(data?.records && recordColumns.some(({ field }) => !allowed.includes(field)));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  return (
    <div className={styles.tableWrapper}>
      <div className={styles.chartHeader}>
        <p className={styles.widgetTitle}>{title}</p>
        {Boolean(widget.properties?.viewAllLabel) && (
          <span className={styles.viewAllLink}>
            {String(widget.properties?.viewAllLabel)}
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
      {invalidColumns ? (
        <p>{t('invalidRecordColumns', 'Configured columns are not present in this resolver result.')}</p>
      ) : error || isLoading || (!data?.values?.length && !data?.records?.length) ? (
        <WidgetDataState
          error={error}
          isLoading={isLoading}
          data={data}
          emptyMessage={String(
            widget.properties?.emptyMessage || widget.properties?.emptyText || t('noRecords', 'No records'),
          )}
          onRetry={retry}
        />
      ) : (
        <>
          <DataTable
            rows={rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            headers={
              (columns ?? (widget.properties?.columns as Array<{ field: string; label: string }> | undefined))?.map(
                (column) => ({
                  key: column.field,
                  header: column.label,
                }),
              ) ?? headers(t)
            }>
            {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()} size="sm">
                  <TableHead>
                    <TableRow>
                      {tableHeaders.map((header) => (
                        <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row) => (
                      <TableRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>
                            {cell.info.header === 'value' &&
                            data?.values?.find((value) => value.obsUuid === row.id)?.valueType === 'CODED' ? (
                              <Tag type="blue" size="sm">
                                {cell.value}
                              </Tag>
                            ) : (
                              cell.value
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
          {data?.truncated && (
            <p>
              {t('resultsTruncated', 'Additional records exist. Increase the source limit or narrow the date window.')}
            </p>
          )}
          {rows.length > pageSize && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              pageSizes={[pageSize]}
              totalItems={rows.length}
              itemsPerPageText={t('itemsPerPage', 'Items per page:')}
              onChange={({ page }) => setPage(page)}
            />
          )}
        </>
      )}
    </div>
  );
}

function headers(t: TFunction) {
  return [
    { key: 'effectiveTime', header: t('date', 'Date') },
    { key: 'value', header: t('value', 'Result') },
  ];
}
