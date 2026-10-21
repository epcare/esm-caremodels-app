import React from 'react';
import { Button, ButtonSet } from '@carbon/react';
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
      <ButtonSet>
        {(widget.actionIds ?? []).map((actionId) => (
          <ActionButton
            key={actionId}
            actionId={actionId}
            label={String(
              (widget.properties?.actionLabels as Record<string, string> | undefined)?.[actionId] ?? actionId,
            )}
          />
        ))}
      </ButtonSet>
    </div>
  );
}

/**
 * Action execution follows the definition's action declaration. The definition carries the
 * handler type; until the workspace exposes full action metadata, buttons render disabled rather
 * than guessing at behavior.
 */
function ActionButton({ actionId, label }: { actionId: string; label: string }) {
  const { t } = useTranslation();
  return (
    <Button kind="tertiary" disabled title={t('actionPendingConfig', 'This action has not been configured yet')}>
      {label}
    </Button>
  );
}
