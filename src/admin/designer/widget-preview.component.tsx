import React, { useMemo } from 'react';
import { Tag } from '@carbon/react';
import { SWRConfig, type Middleware } from 'swr';
import { useTranslation } from 'react-i18next';
import { WorkspaceDescriptorContext } from '../../widgets/workspace-descriptors';
import { WidgetRenderer } from '../../widgets/widget-renderer.component';
import { manifestFor } from '../../widgets/widget-registry';
import type { WidgetInstance } from '../../types/caremodels';
import styles from './designer.scss';

/** Designer-only scope. Even bound widgets cannot execute a clinical fetcher. */
export function WidgetPreview({ widget, tabId }: { widget: WidgetInstance; tabId: string }) {
  const { t } = useTranslation();
  const manifest = manifestFor(widget);
  const config = useMemo(() => {
    const offline: Middleware = (next) => (_key, _fetcher, options) =>
      next(null, null, { ...options, fallbackData: manifest?.fixture as typeof options.fallbackData });
    return { provider: () => new Map(), use: [offline] };
  }, [manifest]);
  // Unbound designer widgets can still demonstrate their appearance. This key is never saved or sent.
  const shown =
    manifest?.data && !widget.dataSource && !widget.dataSources?.length
      ? { ...widget, dataSource: 'preview-only' }
      : widget;
  return (
    <SWRConfig value={config}>
      <div className={styles.previewContent}>
        <Tag className={styles.previewBadge} size="sm" type="cool-gray">
          {t('previewData', 'Preview data')}
        </Tag>
        <WorkspaceDescriptorContext.Provider
          value={{
            version: '1.0.0',
            forms: [],
            actions: [],
            pathway: { status: 'recorded', label: 'Example stage', stage: 'example', enteredAt: '2026-01-01' },
          }}>
          <WidgetRenderer widget={shown} patientUuid="" modelCode="" tabId={tabId} />
        </WorkspaceDescriptorContext.Provider>
      </div>
    </SWRConfig>
  );
}
