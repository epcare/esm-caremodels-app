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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { WidgetInstance } from '../types/caremodels';
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
  const { data, error, isLoading } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);

  const [page, setPage] = useState(1);
  const pageSize = Math.max(5, Math.min(50, Number(widget.properties?.pageSize) || 5));
  const rows = (data?.values ?? []).map((value, index) => ({
    id: value.obsUuid ?? String(index),
    value: value.valueName ?? (value.value !== undefined ? String(value.value) : '—'),
    effectiveTime: value.effectiveTime ?? '—',
  }));

  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  return (
    <div className={styles.tableWrapper}>
      <p className={styles.widgetTitle}>{title}</p>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      {Boolean(widget.properties?.description) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.description)}</p>
      )}
      {error ? (
        <p className={styles.missingData}>{t('dataUnavailable', 'Data unavailable')}</p>
      ) : isLoading ? (
        <p className={styles.missingData}>{t('loading', 'Loading…')}</p>
      ) : rows.length === 0 ? (
        <p className={styles.missingData}>{String(widget.properties?.emptyText || t('noRecords', 'No records'))}</p>
      ) : (
        <>
          <DataTable rows={rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)} headers={headers(t)}>
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
    { key: 'value', header: t('value', 'Value') },
    { key: 'effectiveTime', header: t('date', 'Date') },
  ];
}
