import React from 'react';
import {
  DataTable,
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

  const rows = (data?.values ?? []).map((value, index) => ({
    id: value.obsUuid ?? String(index),
    value: value.value !== undefined ? String(value.value) + (value.valueName ? ` (${value.valueName})` : '') : '—',
    effectiveTime: value.effectiveTime ?? '—',
  }));

  return (
    <div className={styles.tableWrapper}>
      <p className={styles.widgetTitle}>{title}</p>
      {error ? (
        <p className={styles.missingData}>{t('dataUnavailable', 'Data unavailable')}</p>
      ) : isLoading ? (
        <p className={styles.missingData}>{t('loading', 'Loading…')}</p>
      ) : rows.length === 0 ? (
        <p className={styles.missingData}>{t('noRecords', 'No records')}</p>
      ) : (
        <DataTable rows={rows} headers={headers(t)}>
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
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
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
