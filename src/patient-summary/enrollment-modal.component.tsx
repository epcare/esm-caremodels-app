import React, { useMemo, useState } from 'react';
import {
  Button,
  InlineNotification,
  Modal,
  Search,
  Select,
  SelectItem,
  Stack,
  Tag,
  TextArea,
  Tile,
} from '@carbon/react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { enrollInCareModel, fetchManualEnrollmentOptions } from '../api/caremodels.resource';
import type { ManualEnrollmentOption } from '../types/caremodels';
import styles from './care-models-summary.scss';

/**
 * Manual enrollment from the patient dashboard. Choices come exclusively from the authorized
 * backend evaluation endpoint; eligibility is the model's own enrollment policy, never frontend
 * observation data. The backend re-validates everything inside the enrollment transaction.
 */
export function EnrollmentModal({
  patientUuid,
  onClose,
  onEnrolled,
}: {
  patientUuid: string;
  onClose: () => void;
  onEnrolled: (modelCode: string) => void;
}) {
  const { t } = useTranslation();
  const { data: options, error, isLoading, mutate } = useSWR(
    ['caremodels-enrollment-options', patientUuid],
    ([, uuid]: [string, string]) => fetchManualEnrollmentOptions(uuid),
    { shouldRetryOnError: false },
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set((options ?? []).map((option) => option.category).filter(Boolean))] as Array<string>,
    [options],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (options ?? [])
      .filter((option) => category === 'all' || option.category === category)
      .filter(
        (option) =>
          !needle ||
          [option.displayLabel, option.modelCode, option.category]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(needle)),
      );
  }, [options, query, category]);
  const selected = visible.find((option) => option.modelCode === selectedCode) ?? null;

  const submit = async () => {
    if (!selected?.eligible || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await enrollInCareModel({
        operation: 'manual',
        patient: patientUuid,
        model: selected.modelCode,
        reason: reason.trim() || t('enrollmentDefaultReason', 'Enrolled from the patient dashboard'),
      });
      await mutate();
      onEnrolled(selected.modelCode);
    } catch (submitFailure) {
      // Keep the entered reason and selection so the clinician can retry without retyping.
      setSubmitError(extractError(submitFailure));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      modalHeading={t('enrollInCareModel', 'Enroll in a care model')}
      modalLabel={t('careModels', 'Care Models')}
      primaryButtonText={t('confirmEnrollment', 'Confirm enrollment')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={!selected?.eligible || submitting || (selected?.requiresReason === true && !reason.trim())}
      onRequestSubmit={() => void submit()}
      onRequestClose={onClose}
      size="lg">
      <Stack gap={4}>
        {error ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('enrollmentOptionsUnavailable', 'Could not load enrollable care models')}
            subtitle={t('enrollmentOptionsUnavailableSubtitle', 'Refresh or contact an administrator.')}
          />
        ) : isLoading ? (
          <p className={styles.sectionHint}>{t('loading', 'Loading…')}</p>
        ) : (
          <>
            <Stack gap={3}>
              <Search
                size="sm"
                id="enrollment-model-search"
                labelText={t('searchModelLabel', 'Search permitted models')}
                placeholder={t('searchModelPlaceholder', 'Search by name or code')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {categories.length > 1 && (
                <Select
                  id="enrollment-category"
                  size="sm"
                  labelText={t('categoryFilter', 'Category')}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}>
                  <SelectItem value="all" text={t('allCategories', 'All categories')} />
                  {categories.map((value) => (
                    <SelectItem key={value} value={value} text={value} />
                  ))}
                </Select>
              )}
            </Stack>
            {!visible.length ? (
              <p className={styles.emptyState}>
                {t('noEnrollableModels', 'No manually enrollable care models are available for this patient.')}
              </p>
            ) : (
              visible.map((option) => (
                <EnrollmentOptionRow
                  key={option.modelCode}
                  option={option}
                  selected={option.modelCode === selectedCode}
                  onSelect={() => setSelectedCode(option.modelCode)}
                />
              ))
            )}
            {selected?.eligible && (
              <Tile className={styles.enrollmentConfirmation}>
                <p className={styles.sectionHint}>
                  {t(
                    'enrollmentConfirmation',
                    'Enrolling {{label}} ({{code}}) for this patient. The backend re-checks authorization and eligibility when you confirm.',
                    { label: selected.displayLabel, code: selected.modelCode },
                  )}
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
              </Tile>
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
          </>
        )}
      </Stack>
    </Modal>
  );
}

function EnrollmentOptionRow({
  option,
  selected,
  onSelect,
}: {
  option: ManualEnrollmentOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`${styles.enrollmentOption} ${selected ? styles.enrollmentOptionSelected : ''}`}
      aria-pressed={selected}
      onClick={onSelect}>
      <span className={styles.enrollmentOptionMain}>
        <strong>{option.displayLabel}</strong>
        {Boolean(option.category) && <Tag type="blue" size="sm">{option.category!}</Tag>}
        {option.alreadyEnrolled && <Tag type="gray" size="sm">{t('alreadyEnrolled', 'Already enrolled')}</Tag>}
        {option.eligible && !option.alreadyEnrolled && <Tag type="green" size="sm">{t('eligible', 'Eligible')}</Tag>}
      </span>
      <span className={styles.enrollmentOptionMeta}>
        {option.modelCode}
        {option.reason ? ` · ${option.reason}` : ''}
      </span>
    </button>
  );
}

function extractError(failure: unknown): string {
  const response = (failure as { response?: { data?: { error?: { message?: string } } } })?.response?.data;
  return (
    response?.error?.message ??
    (failure as { message?: string })?.message ??
    (failure as string) ??
    'Enrollment failed'
  );
}
