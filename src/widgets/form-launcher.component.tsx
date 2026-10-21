import React, { useContext } from 'react';
import { WorkspaceDescriptorContext } from './workspace-descriptors';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { WidgetInstance } from '../types/caremodels';
import styles from './widgets.scss';

/** Raw workspace widgets contain an alias, not an authorized resolved form reference. */
export function FormLauncherWidget({ widget }: { widget: WidgetInstance; patientUuid: string }) {
  const { t } = useTranslation();
  const label = String(widget.properties?.title ?? t('openForm', 'Open form'));
  const descriptors = useContext(WorkspaceDescriptorContext)?.forms ?? [];
  const aliases = [...new Set([widget.formAlias, ...(widget.formAliases ?? [])].filter(Boolean))] as Array<string>;
  const buttons = aliases.length ? aliases : [''];
  return (
    <div className={styles.formLauncher}>
      <p className={styles.widgetTitle}>{label}</p>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      {Boolean(widget.properties?.description) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.description)}</p>
      )}
      {buttons.map((alias) => {
        const descriptor = descriptors.find((form) => form.alias === alias);
        const reason = descriptor?.reason
          ? t(`capabilityReason.${descriptor.reason}`, descriptor.reason)
          : t('formMetadataUnavailable', 'The workspace API has not supplied a resolved form reference.');
        return (
          <div key={alias}>
            <Button kind="primary" disabled title={reason}>
              {buttons.length > 1
                ? (descriptor?.name ?? alias)
                : String(widget.properties?.buttonLabel || t('openForm', 'Open form'))}
            </Button>
            <p>{reason}</p>
          </div>
        );
      })}
    </div>
  );
}
