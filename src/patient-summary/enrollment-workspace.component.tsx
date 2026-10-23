import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, InlineNotification, Search, Tag, TextArea, Tile } from '@carbon/react';
import useSWR from 'swr';
import { launchWorkspace2, showSnackbar, usePatient, Workspace2 } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { enrollInCareModel, fetchEnrollmentCheck, fetchManualEnrollmentOptions } from '../api/caremodels.resource';
import type { ManualEnrollmentOption } from '../types/caremodels';
import styles from './care-models-summary.scss';

type WorkspacePropsShape = {
  workspaceProps?: { patientUuid?: string };
  groupProps?: { patientUuid?: string };
  closeWorkspace?: (options?: { closeWindow?: boolean }) => void;
  promptBeforeClosing?: (testFcn: () => boolean) => void;
};

type EnrollmentCheck = {
  modelCode: string;
  status: 'ELIGIBLE' | 'REQUIRES_CONFIRMATION' | 'ALREADY_ENROLLED' | 'NOT_ELIGIBLE';
  canEnroll: boolean;
  requiresReason: boolean;
  requiresConfirmation: boolean;
  reasons: Array<string>;
};

/**
 * Native right-side enrollment workspace (single continuous experience): model selection,
 * policy-driven eligibility check, enrollment details and review. Eligibility is evaluated by
 * the backend only on deliberate model selection; enrollment re-validates everything in its
 * transaction before persisting to care_model_member.
 */
export default function EnrollmentWorkspace({
  closeWorkspace,
  promptBeforeClosing,
  workspaceProps,
  groupProps,
}: WorkspacePropsShape) {
  const { t } = useTranslation();
  // Inside the patient chart the workspace group carries the authoritative patient context.
  const patientUuid = groupProps?.patientUuid ?? workspaceProps?.patientUuid ?? '';
  const { patient } = usePatient(patientUuid);

  const { data: options, isLoading: optionsLoading, error: optionsError } = useSWR(
    patientUuid ? ['caremodels-enrollment-options', patientUuid] : null,
    ([, uuid]: [string, string]) => fetchManualEnrollmentOptions(uuid),
    { shouldRetryOnError: false },
  );
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [check, setCheck] = useState<EnrollmentCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selected = useMemo(
    () => (options ?? []).find((option) => option.modelCode === selectedCode) ?? null,
    [options, selectedCode],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (options ?? []).filter(
      (option) =>
        !needle ||
        [option.displayLabel, option.modelCode, option.category]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [options, query]);

  // Explicit eligibility evaluation, only after a deliberate model selection.
  useEffect(() => {
    if (!selectedCode || !patientUuid) return;
    let active = true;
    setChecking(true);
    setCheckError(null);
    setCheck(null);
    fetchEnrollmentCheck(patientUuid, selectedCode)
      .then((result) => {
        if (active) setCheck(result);
      })
      .catch((checkFailure) => {
        if (active) setCheckError(extractError(checkFailure));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCode, patientUuid]);

  // Workspace dirty state: an entered reason blocks silent closure.
  useEffect(() => {
    promptBeforeClosing?.(() => Boolean(reason.trim()));
  }, [reason, promptBeforeClosing]);

  const discard = useCallback(() => closeWorkspace?.({ closeWindow: true }), [closeWorkspace]);

  const canSubmit = Boolean(
    selected &&
      check?.canEnroll &&
      !checking &&
      !submitting &&
      (!selected.requiresReason || reason.trim()) &&
      (!selected.requiresConfirmation || confirmed),
  );

  const submit = async () => {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await enrollInCareModel({
        operation: 'manual',
        patient: patientUuid,
        model: selected.modelCode,
        reason: reason.trim() || t('enrollmentDefaultReason', 'Enrolled from the patient dashboard'),
      });
      closeWorkspace?.({ closeWindow: true });
      showSnackbar({
        kind: 'success',
        isLowContrast: true,
        title: t('enrolledTitle', 'Enrollment successful'),
        subtitle: t('enrolledSubtitle', 'The care model workspace is now available for this patient.'),
      });
    } catch (submitFailure) {
      // Keep the entered reason and selection so the clinician can retry without retyping.
      setSubmitError(extractError(submitFailure));
    } finally {
      setSubmitting(false);
    }
  };

  const patientName = patient?.name?.[0]?.text ?? patient?.name?.[0]?.family ?? '—';
  const identifier = patient?.identifier?.[0]?.value;
  const eligibilityText = check
    ? {
        ELIGIBLE: t('eligibilityEligible', 'Eligible'),
        REQUIRES_CONFIRMATION: t('eligibilityRequiresConfirmation', 'Requires confirmation'),
        ALREADY_ENROLLED: t('eligibilityAlreadyEnrolled', 'Already enrolled'),
        NOT_ELIGIBLE: t('eligibilityNotEligible', 'Not eligible'),
      }[check.status]
    : null;

  return (
    <Workspace2 title={t('enrollInCareModel', 'Enroll in care model')}>
      <div className={styles.enrollmentWorkspace}>
        <div className={styles.enrollmentPatientContext}>
          <strong>{patientName}</strong>
          <span className={styles.sectionHint}>{[patient?.gender, identifier].filter(Boolean).join(' · ')}</span>
        </div>

        <section aria-label={t('selectCareModelSection', 'Select care model')}>
          <h5>{t('selectCareModelSection', '1. Select care model')}</h5>
          <Search
            size="sm"
            id="enrollment-model-search"
            labelText={t('searchModelLabel', 'Search care models')}
            placeholder={t('searchModelPlaceholder', 'Search by name or code')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {optionsError ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('enrollmentOptionsUnavailable', 'Could not load enrollable care models')}
            />
          ) : optionsLoading ? (
            <p className={styles.sectionHint}>{t('loading', 'Loading…')}</p>
          ) : !visible.length ? (
            <p className={styles.emptyState}>
              {t('noEnrollableModels', 'No manually enrollable care models are available for this patient.')}
            </p>
          ) : (
            visible.map((option) => (
              <button
                key={option.modelCode}
                type="button"
                aria-pressed={option.modelCode === selectedCode}
                className={`${styles.enrollmentOption} ${
                  option.modelCode === selectedCode ? styles.enrollmentOptionSelected : ''
                }`}
                onClick={() => setSelectedCode(option.modelCode)}>
                <span className={styles.enrollmentOptionMain}>
                  <strong>{option.displayLabel}</strong>
                  {option.category && <Tag type="blue" size="sm">{option.category}</Tag>}
                  {option.alreadyEnrolled && (
                    <Tag type="gray" size="sm">{t('alreadyEnrolled', 'Already enrolled')}</Tag>
                  )}
                  {!option.alreadyEnrolled && !option.eligible && (
                    <Tag type="red" size="sm">{t('notEligibleTag', 'Not eligible')}</Tag>
                  )}
                </span>
                <span className={styles.enrollmentOptionMeta}>{option.modelCode}</span>
              </button>
            ))
          )}
        </section>

        <section aria-label={t('eligibilitySection', 'Enrollment eligibility')}>
          <h5>{t('eligibilitySection', '2. Eligibility status')}</h5>
          {!selectedCode ? (
            <p className={styles.sectionHint}>{t('eligibilityHint', 'Select a care model to check eligibility.')}</p>
          ) : checking ? (
            <p className={styles.sectionHint}>{t('checkingEligibility', 'Checking eligibility…')}</p>
          ) : checkError ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('eligibilityUnableToEvaluate', 'Unable to evaluate eligibility')}
              subtitle={checkError}
            />
          ) : check ? (
            <Tile className={styles.enrollmentConfirmation}>
              <p>
                <strong>{eligibilityText}</strong>
              </p>
              {check.reasons.map((entry) => (
                <p key={entry} className={styles.sectionHint}>
                  {entry}
                </p>
              ))}
            </Tile>
          ) : null}
        </section>

        {selected && check?.canEnroll && (
          <section aria-label={t('detailsSection', 'Enrollment details')}>
            <h5>{t('detailsSection', '3. Enrollment details')}</h5>
            <p className={styles.sectionHint}>
              {t('selectedModel', 'Selected')}: {selected.displayLabel} ({selected.modelCode})
            </p>
            <p className={styles.sectionHint}>
              {t('enrollmentDateReadOnly', 'Enrollment date')}:{' '}
              {t('serverTimestampNote', 'recorded by the server when you submit')}
            </p>
            {selected.requiresReason && (
              <TextArea
                id="enrollment-reason"
                labelText={t('enrollmentReason', 'Enrollment reason (required)')}
                placeholder={t('enrollmentReasonPlaceholder', 'Clinical decision or context')}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            )}
            {selected.requiresConfirmation && (
              <Checkbox
                id="enrollment-confirmation"
                labelText={t('enrollmentConfirmationLabel', 'I confirm this enrollment with the patient')}
                checked={confirmed}
                onChange={(_, { checked }) => setConfirmed(checked)}
              />
            )}
          </section>
        )}

        {selected && check && (
          <section aria-label={t('summarySection', 'Review and confirm')}>
            <h5>{t('summarySection', '4. Summary')}</h5>
            <p className={styles.sectionHint}>
              {t('summaryPatient', 'Patient')}: {patientName}
            </p>
            <p className={styles.sectionHint}>
              {t('selectedModel', 'Selected')}: {selected.displayLabel} ({selected.modelCode})
            </p>
            <p className={styles.sectionHint}>
              {t('eligibilitySection', 'Eligibility')}: {eligibilityText ?? '—'}
            </p>
            {reason.trim() && (
              <p className={styles.sectionHint}>
                {t('enrollmentReason', 'Reason')}: {reason.trim()}
              </p>
            )}
          </section>
        )}

        {submitError && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('enrollmentNotApplied', 'Enrollment was not applied')}
            subtitle={submitError}
          />
        )}

        <div className={styles.enrollmentWorkspaceFooter}>
          <Button kind="secondary" onClick={discard}>
            {t('discard', 'Discard')}
          </Button>
          <Button kind="primary" disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? t('submitting', 'Enrolling…') : t('enrollPatient', 'Enroll patient')}
          </Button>
        </div>
      </div>
    </Workspace2>
  );
}

function extractError(failure: unknown): string {
  const response = (failure as { response?: { data?: { error?: { message?: string } } } })?.response?.data;
  return (
    response?.error?.message ??
    (failure as { message?: string })?.message ??
    (typeof failure === 'string' ? failure : '') ??
    'Enrollment failed'
  );
}

/** Exported for the dashboard's main enrollment action; opens the same registered workspace. */
export function launchEnrollmentWorkspace(patientUuid: string) {
  launchWorkspace2('care-model-enrollment', { patientUuid });
}
