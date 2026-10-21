import React from 'react';
import { Button, InlineNotification } from '@carbon/react';
import { Add, Renew } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import styles from './care-models-summary.scss';

/** No write capability is advertised until the backend exposes an enrollment contract. */
export function EnrollmentControls({
  count,
  refreshing,
  onRefresh,
}: {
  count?: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.enrollmentToolbar}>
        <p className={styles.enrollmentCount}>
          {count !== undefined ? t('activeEnrollmentCount', 'Active enrollments: {{count}}', { count }) : null}
        </p>
        <Button kind="tertiary" renderIcon={Renew} disabled={refreshing} onClick={onRefresh}>
          {refreshing
            ? t('refreshingEnrollments', 'Refreshing enrollments…')
            : t('refreshEnrollments', 'Refresh enrollments')}
        </Button>
        <Button
          renderIcon={Add}
          disabled
          title={t('enrollmentUnavailable', 'Enrolling patients is not available yet.')}>
          {t('enrollInCareModel', 'Enroll in a care model')}
        </Button>
      </div>
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('enrollmentUnavailableTitle', 'Enrollment is not available')}
        subtitle={t(
          'enrollmentUnavailableDescription',
          'You can view current enrollments, but adding or changing enrollments is not available in this installation.',
        )}
      />
    </>
  );
}
