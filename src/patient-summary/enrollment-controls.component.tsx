import React from 'react';
import { Button, IconButton } from '@carbon/react';
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
        <Button kind="primary" size="sm" renderIcon={Add} onClick={onEnroll}>
          {t('enrollPatientInCareModel', 'Enroll patient in a care model')}
        </Button>
      )}
      <IconButton kind="ghost" size="sm" label={label} disabled={refreshing} onClick={onRefresh} align="bottom-end">
        <Renew />
      </IconButton>
    </div>
  );
}
