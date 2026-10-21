import React from 'react';
import { Group, Location } from '@carbon/react/icons';
import { PageHeader, useSession } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import styles from './care-models-admin-home.scss';

export function CareModelsRegistryHeader() {
  const { t } = useTranslation();
  const session = useSession();
  const location = session?.sessionLocation?.display;
  const user = session?.user?.person?.display ?? session?.user?.display;
  return (
    <PageHeader className={styles.pageHeader}>
      <div className={styles.headerIdentity}>
        <Group size={48} className={styles.headerIcon} aria-hidden />
        <div>
          <p className={styles.moduleLabel}>{t('careModels', 'Care Models')}</p>
          <h1 className={styles.pageTitle}>{t('home', 'Home')}</h1>
        </div>
      </div>
      {(user || location) && (
        <div className={styles.sessionMetadata}>
          {user && <p>{user}</p>}
          {location && (
            <p className={styles.sessionLocation}>
              <Location size={16} aria-hidden />
              <span>{location}</span>
            </p>
          )}
        </div>
      )}
    </PageHeader>
  );
}
