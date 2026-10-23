import React from 'react';
import { IconButton } from '@carbon/react';
import { Add, Renew } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import styles from './care-models-summary.scss';

/** Refreshes the authorized membership list; this REST API has no enrollment write operation. */
export function MembershipControls({
  refreshing,
  onRefresh,
  onEnroll,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  onEnroll?: () => void;
}) {
  const { t } = useTranslation();
  const label = refreshing
    ? t('refreshingEnrollments', 'Refreshing enrollments…')
    : t('refreshEnrollments', 'Refresh enrollments');
  return (
    <div className={styles.enrollmentToolbar}>
      {onEnroll && (
        <IconButton
          kind="ghost"
          size="sm"
          label={t('enrollInCareModel', 'Enroll in a care model')}
          onClick={onEnroll}
          align="bottom-end">
          <Add />
        </IconButton>
      )}
      <IconButton kind="ghost" size="sm" label={label} disabled={refreshing} onClick={onRefresh} align="bottom-end">
        <Renew />
      </IconButton>
    </div>
  );
}
