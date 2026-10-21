import React from 'react';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { WidgetInstance } from '../types/caremodels';
import styles from './widgets.scss';

/** Raw workspace widgets contain an alias, not an authorized resolved form reference. */
export function FormLauncherWidget({ widget }: { widget: WidgetInstance; patientUuid: string }) {
  const { t } = useTranslation();
  const label = String(widget.properties?.title ?? t('openForm', 'Open form'));
  const reason = t('formMetadataUnavailable', 'The workspace API has not supplied a resolved form reference.');
  return (
    <div className={styles.formLauncher}>
      <p className={styles.widgetTitle}>{label}</p>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      {Boolean(widget.properties?.description) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.description)}</p>
      )}
      <Button kind="primary" disabled title={reason}>
        {label}
      </Button>
      <p>{reason}</p>
    </div>
  );
}
