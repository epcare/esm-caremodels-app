import React from 'react';
import { InlineNotification, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import { formatClinicalDate } from './clinical-format';
import styles from './widgets.scss';

/** Presentation of backend-documented records; no clinical states are inferred here. */
export function RecordWidget({
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
  const expected: Record<string, Array<string>> = {
    'condition-list': ['conditions', 'encounter-diagnoses'],
    'medication-summary': ['order-query'],
    'program-summary': ['program-state'],
    'patient-summary': ['patient-summary'],
  };
  if (!error && data && !expected[widget.type]?.includes(data.type))
    return (
      <InlineNotification
        kind="warning"
        hideCloseButton
        title={t('unsupportedWidgetResult', 'This result is incompatible with the configured widget.')}
      />
    );
  const fields = Object.entries(data?.fields ?? {});
  const records = data?.records ?? [];
  const empty = !fields.length && !records.length;
  return (
    <section className={styles.recordCard}>
      <p className={styles.widgetTitle}>{String(widget.properties?.title ?? widget.id)}</p>
      {['subtitle', 'description'].map((key) =>
        widget.properties?.[key] ? <p key={key}>{String(widget.properties[key])}</p> : null,
      )}
      {error || isLoading || empty ? (
        <WidgetDataState
          error={error}
          isLoading={isLoading}
          emptyMessage={String(widget.properties?.emptyText ?? t('noClinicalRecords', 'No clinical records available'))}
          onRetry={retry}
        />
      ) : (
        <>
          {fields.length > 0 && (
            <dl className={styles.recordFields}>
              {fields.map(([key, value]) => (
                <React.Fragment key={key}>
                  <dt>{t(`patientField.${key}`, key)}</dt>
                  <dd>
                    {value === null
                      ? t('notRecorded', 'Not recorded')
                      : typeof value === 'boolean'
                        ? value
                          ? t('yes', 'Yes')
                          : t('no', 'No')
                        : key.toLowerCase().includes('date')
                          ? formatClinicalDate(String(value))
                          : String(value)}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          {data?.scope && <p className={styles.widgetSubtitle}>{t(`recordScope.${data.scope}`, data.scope)}</p>}
          <ul className={`${styles.trendList} ${styles.recordList}`}>
            {records.map((record) => (
              <li key={record.uuid} className={styles.recordItem}>
                {widget.type === 'condition-list' && (
                  <>
                    <div className={styles.recordMain}>
                      <span className={styles.recordName}>
                        {String(record.name ?? t('unnamedCondition', 'Unnamed diagnosis or condition'))}
                      </span>
                      {Boolean(record.clinicalStatus) && <Tag type="gray" size="sm">{String(record.clinicalStatus)}</Tag>}
                    </div>
                    {Boolean(record.onsetDate || record.effectiveTime) && (
                      <p className={styles.recordMeta}>
                        {formatClinicalDate(String(record.onsetDate ?? record.effectiveTime))}
                      </p>
                    )}
                    {Boolean(record.certainty) && (
                      <p className={styles.recordMeta}>
                        {t('certainty', 'Certainty')}: {String(record.certainty)}
                      </p>
                    )}
                    {Boolean(record.endDate) && (
                      <p className={styles.recordMeta}>
                        {t('ended', 'Ended')}: {formatClinicalDate(String(record.endDate))}
                      </p>
                    )}
                  </>
                )}
                {widget.type === 'medication-summary' && (
                  <>
                    <div className={styles.recordMain}>
                      <span className={styles.recordName}>
                        {String(record.drugName ?? t('medicationOrder', 'Medication order'))}
                      </span>
                      {typeof record.activeAtAssessment === 'boolean' && (
                        <Tag type={record.activeAtAssessment ? 'green' : 'gray'} size="sm">
                          {record.activeAtAssessment
                            ? t('activeAtAssessment', 'Active at assessment')
                            : t('inactiveAtAssessment', 'Inactive at assessment')}
                        </Tag>
                      )}
                    </div>
                    {record.dose !== undefined && (
                      <p className={styles.recordMeta}>
                        {t('dose', 'Dose')}: {String(record.dose)}
                      </p>
                    )}
                    {Boolean(record.action) && (
                      <p className={styles.recordMeta}>
                        {t('orderAction', 'Order action')}: {String(record.action)}
                      </p>
                    )}
                    {Boolean(record.dateActivated) && (
                      <p className={styles.recordMeta}>{formatClinicalDate(String(record.dateActivated))}</p>
                    )}
                    {Boolean(record.effectiveStopDate) && (
                      <p className={styles.recordMeta}>
                        {t('ended', 'Ended')}: {formatClinicalDate(String(record.effectiveStopDate))}
                      </p>
                    )}
                  </>
                )}
                {widget.type === 'program-summary' && (
                  <>
                    {Boolean(record.dateEnrolled) && (
                      <p className={styles.recordMeta}>
                        {t('enrollmentDate', 'Enrollment date')}: {formatClinicalDate(String(record.dateEnrolled))}
                      </p>
                    )}
                    {Boolean(record.dateCompleted) && (
                      <p className={styles.recordMeta}>
                        {t('completionDate', 'Completion date')}: {formatClinicalDate(String(record.dateCompleted))}
                      </p>
                    )}
                    {Array.isArray(record.currentStates) &&
                      (record.currentStates as Array<{ uuid: string; stateUuid: string; startDate: string }>).map((state) => (
                        <p key={state.uuid} className={styles.recordMeta}>
                          {t('programStateReference', 'Program state reference')}: {state.stateUuid} ·{' '}
                          {formatClinicalDate(state.startDate)}
                        </p>
                      ))}
                  </>
                )}
              </li>
            ))}
          </ul>
          {data?.truncated && (
            <p>
              {t('resultsTruncated', 'Additional records exist. Increase the source limit or narrow the date window.')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
