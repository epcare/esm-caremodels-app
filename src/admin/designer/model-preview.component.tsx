import React, { useState } from 'react';
import { Dropdown, InlineNotification, Stack, Tile } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { WidgetPreview } from './widget-preview.component';
import type { ModelDefinition } from '../../types/caremodels';
import styles from './designer.scss';

export function ModelPreview({ definition }: { definition: ModelDefinition }) {
  const { t } = useTranslation();
  const [tabId, setTabId] = useState(definition.workspace.defaultTab);
  const tab = definition.workspace.tabs.find((item) => item.id === tabId) ?? definition.workspace.tabs[0];
  return (
    <Stack gap={5}>
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('demonstrationPreview', 'Demonstration data — not a patient record')}
        subtitle={t(
          'demonstrationPreviewHint',
          'Preview uses synthetic values. Forms and actions are disabled; no clinical data requests are sent.',
        )}
      />
      <Dropdown
        id="preview-internal-tab"
        titleText={t('previewInternalTab', 'Workspace tab')}
        label={t('selectTab', 'Select a tab')}
        items={definition.workspace.tabs}
        selectedItem={tab}
        itemToString={(item) => item?.label ?? ''}
        onChange={({ selectedItem }) => setTabId(selectedItem?.id)}
      />
      {!tab?.widgets.length ? (
        <Tile>{t('previewEmptyTab', 'This tab has no configured components.')}</Tile>
      ) : (
        <>
          <div className={styles.previewGrid}>
            {tab.widgets.map((widget) => {
              const position = tab.layouts?.wide?.find((item) => item.widgetId === widget.id) ?? widget.position;
              return (
                <Tile
                  key={widget.id}
                  className={styles.previewWidget}
                  style={{ gridColumn: position ? `${position.col} / span ${position.w}` : '1 / -1' }}>
                  <WidgetPreview widget={widget} tabId={tab.id} />
                </Tile>
              );
            })}
          </div>
        </>
      )}
    </Stack>
  );
}
