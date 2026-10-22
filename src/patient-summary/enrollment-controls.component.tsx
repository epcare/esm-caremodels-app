import React from 'react';
import { Button } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import styles from './care-models-summary.scss';

/** Refreshes the authorized membership list; this REST API has no enrollment write operation. */
export function MembershipControls({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.enrollmentToolbar}>
      <Button kind="tertiary" renderIcon={Renew} disabled={refreshing} onClick={onRefresh}>
        {refreshing
          ? t('refreshingEnrollments', 'Refreshing enrollments…')
          : t('refreshEnrollments', 'Refresh enrollments')}
      </Button>
    </div>
  );
}
