import React, { useContext } from 'react';
import { WorkspaceDescriptorContext } from './workspace-descriptors';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { WidgetInstance } from '../types/caremodels';
import styles from './widgets.scss';

/**
 * Action panel: renders the widget's declared actions. Only allowlisted handler types exist
 * server-side; the panel never grants permissions — each action re-enters the guarded backend
 * endpoints when it has a server effect.
 */
export function ActionPanelWidget({ widget }: { widget: WidgetInstance }) {
  const { t } = useTranslation();
  const title = (widget.properties?.title as string) ?? t('actions', 'Actions');

  return (
    <div className={styles.actionPanel}>
      <p className={styles.widgetTitle}>{title}</p>
      {Boolean(widget.properties?.subtitle) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.subtitle)}</p>
      )}
      {Boolean(widget.properties?.description) && (
        <p className={styles.widgetSubtitle}>{String(widget.properties?.description)}</p>
      )}
      {!widget.actionIds?.length && <p>{t('noConfiguredActions', 'No actions configured.')}</p>}
      <div className={styles.actionList}>
        {(widget.actionIds ?? []).map((actionId, index) => (
          <ActionButton
            key={actionId}
            actionId={actionId}
            index={index}
            label={String(
              (widget.properties?.actionLabels as Record<string, string> | undefined)?.[actionId] ?? actionId,
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Action execution follows the definition's action declaration. The definition carries the
 * handler type; until the workspace exposes full action metadata, buttons render disabled rather
 * than guessing at behavior. The first action renders as the panel's emphasized entry, matching
 * the approved widget catalog.
 */
function ActionButton({ actionId, label, index }: { actionId: string; label: string; index: number }) {
  const { t } = useTranslation();
  const descriptor = useContext(WorkspaceDescriptorContext)?.actions.find((action) => action.id === actionId);
  return (
    <Button
      kind={index === 0 ? 'primary' : 'tertiary'}
      size="sm"
      disabled
      title={
        descriptor?.reason
          ? t(`capabilityReason.${descriptor.reason}`, descriptor.reason)
          : t('actionPendingConfig', 'This action has not been configured yet')
      }>
      {label}
    </Button>
  );
}
