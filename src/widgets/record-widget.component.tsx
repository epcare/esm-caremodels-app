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
    <section>
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
            <dl>
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
                          ? formatClinicalDate(value)
                          : value}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          {data?.scope && <p className={styles.widgetSubtitle}>{t(`recordScope.${data.scope}`, data.scope)}</p>}
          <ul className={styles.trendList}>
            {records.map((record) => (
              <li key={record.uuid} className={styles.recordItem}>
                {widget.type === 'condition-list' && (
                  <>
                    <strong>{String(record.name ?? t('unnamedCondition', 'Unnamed diagnosis or condition'))}</strong>
                    {Boolean(record.clinicalStatus) && <Tag type="gray">{String(record.clinicalStatus)}</Tag>}
                    {Boolean(record.certainty) && (
                      <p>
                        {t('certainty', 'Certainty')}: {String(record.certainty)}
                      </p>
                    )}
                    <p>{formatClinicalDate(String(record.onsetDate ?? record.effectiveTime ?? ''))}</p>
                    {Boolean(record.endDate) && (
                      <p>
                        {t('ended', 'Ended')}: {formatClinicalDate(String(record.endDate))}
                      </p>
                    )}
                  </>
                )}
                {widget.type === 'medication-summary' && (
                  <>
                    <strong>{String(record.drugName ?? t('medicationOrder', 'Medication order'))}</strong>
                    <p>
                      {t('orderAction', 'Order action')}: {String(record.action ?? '')}
                    </p>
                    {typeof record.activeAtAssessment === 'boolean' && (
                      <Tag type="gray">
                        {record.activeAtAssessment
                          ? t('activeAtAssessment', 'Active at assessment')
                          : t('inactiveAtAssessment', 'Inactive at assessment')}
                      </Tag>
                    )}
                    <p>{formatClinicalDate(String(record.dateActivated ?? ''))}</p>
                    {Boolean(record.effectiveStopDate) && (
                      <p>
                        {t('ended', 'Ended')}: {formatClinicalDate(String(record.effectiveStopDate))}
                      </p>
                    )}
                    {record.dose !== undefined && (
                      <p>
                        {t('dose', 'Dose')}: {String(record.dose)}
                      </p>
                    )}
                  </>
                )}
                {widget.type === 'program-summary' && (
                  <>
                    <p>
                      {t('enrollmentDate', 'Enrollment date')}: {formatClinicalDate(String(record.dateEnrolled ?? ''))}
                    </p>
                    {Boolean(record.dateCompleted) && (
                      <p>
                        {t('completionDate', 'Completion date')}: {formatClinicalDate(String(record.dateCompleted))}
                      </p>
                    )}
                    {Array.isArray(record.currentStates) &&
                      record.currentStates.map((state: { uuid: string; stateUuid: string; startDate: string }) => (
                        <p key={state.uuid}>
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
