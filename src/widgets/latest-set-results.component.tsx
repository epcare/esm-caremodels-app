import React from 'react';
import { InlineNotification, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import {
  configuredMembers,
  displayRows,
  formatReferenceRange,
  formatSetDate,
  formatSetMemberValue,
  rowsFromGroup,
} from './observation-set-format';
import styles from './widgets.scss';

/**
 * Latest Set Results: renders the newest qualifying parent observation group of a grouped
 * observation-set source. The latest result is the latest recorded group — values are never
 * combined across groups. Coded, text, date and boolean members render alongside numeric ones.
 */
export function LatestSetResultsWidget({
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
  const showMissing = properties.showMissing !== false;
  const showUnits = properties.showUnits !== false;
  const showReferenceRange = properties.showReferenceRange === true;
  const showDate = properties.showDate !== false;
  const maxVisible = Number(properties.maxVisible) || 12;
  const members = configuredMembers(properties);
  const latest = data?.groups?.[0];
  const rows = (
    members.length ? displayRows(latest, members, showMissing) : latest ? rowsFromGroup(latest) : []
  ).slice(0, maxVisible);
  const title = String(properties.title ?? widget.id);

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.chartHeader}>
        <h4 className={styles.widgetTitle}>
          {title}
          {data?.setDisplay && <Tag size="sm" type="blue">{data.setDisplay}</Tag>}
        </h4>
        {Boolean(properties.viewAllLabel) && (
          <span className={styles.viewAllLink}>
            {String(properties.viewAllLabel)}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      {Boolean(properties.subtitle) && <p className={styles.widgetSubtitle}>{String(properties.subtitle)}</p>}
      {Boolean(properties.description) && <p className={styles.widgetSubtitle}>{String(properties.description)}</p>}
      {showDate && latest?.effectiveDate && (
        <p className={styles.widgetSubtitle}>
          {t('latestSetDate', 'Latest results · {{date}}', { date: formatSetDate(latest.effectiveDate) })}
        </p>
      )}
      {error || isLoading || !data?.groups?.length ? (
        <WidgetDataState
          error={error}
          isLoading={isLoading}
          data={data}
          emptyMessage={String(
            properties.emptyMessage || properties.emptyText || t('noSetResults', 'No recorded group results'),
          )}
          onRetry={retry}
        />
      ) : (
        <>
          <Table size={properties.density === 'regular' ? 'md' : 'sm'}>
            <TableHead>
              <TableRow>
                <TableHeader>{t('memberHeader', 'Test / Member')}</TableHeader>
                <TableHeader>{t('result', 'Result')}</TableHeader>
                {showUnits && <TableHeader>{t('unit', 'Unit')}</TableHeader>}
                {showReferenceRange && <TableHeader>{t('referenceRange', 'Reference range')}</TableHeader>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>
                    {row.values.length ? (
                      row.values.map((member) => (
                        <div key={member.obsUuid} className={styles.setMemberValue}>
                          {member.datatype === 'CODED' ? (
                            <Tag size="sm" type="blue">
                              {formatSetMemberValue(member)}
                            </Tag>
                          ) : (
                            formatSetMemberValue(member)
                          )}
                          {member.comment && (
                            <span className={styles.memberComment}>{member.comment}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className={styles.missingValue}>{t('missingResult', 'Not recorded')}</span>
                    )}
                  </TableCell>
                  {showUnits && <TableCell>{row.values[0]?.unit ?? ''}</TableCell>}
                  {showReferenceRange && (
                    <TableCell>{formatReferenceRange(row.values[0]?.referenceRange)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {members.filter((member) => member.inTable).length > rows.length && (
            <p className={styles.sectionHint}>
              {t('membersHidden', '{{count}} more members not shown', {
                count: members.filter((member) => member.inTable).length - rows.length,
              })}
            </p>
          )}
          {members.length > 0 && members.some((member) => member.inTable && !latest?.members.some((recorded) => recorded.conceptUuid === member.conceptUuid)) && showMissing && (
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              title={t('setMembersMissing', 'Some configured members have no recorded result in the latest group.')}
            />
          )}
        </>
      )}
    </div>
  );
}
