import React, { useMemo } from 'react';
import { Tag } from '@carbon/react';
import { SWRConfig, type Middleware } from 'swr';
import { useTranslation } from 'react-i18next';
import { WidgetRenderer } from '../../widgets/widget-renderer.component';
import { manifestFor } from '../../widgets/widget-registry';
import type { WidgetInstance } from '../../types/caremodels';

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
  const shown = manifest?.data && !widget.dataSource ? { ...widget, dataSource: 'preview-only' } : widget;
  return (
    <SWRConfig value={config}>
      <Tag size="sm" type="cool-gray">
        {t('previewData', 'Preview data')}
      </Tag>
      <WidgetRenderer widget={shown} patientUuid="" modelCode="" tabId={tabId} />
    </SWRConfig>
  );
}
