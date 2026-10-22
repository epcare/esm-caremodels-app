import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InlineNotification, SkeletonPlaceholder, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { useWorkspaceTab } from '../api/caremodels.resource';
import type { CareModelMembership, TabSummary, WidgetInstance, WorkspaceTab } from '../types/caremodels';
import { WorkspaceDescriptorContext } from '../widgets/workspace-descriptors';
import { WidgetRenderer } from '../widgets/widget-renderer.component';
import styles from './care-models-summary.scss';

/**
 * Inner tabs of ONE selected model. The first fetch (no tab id) returns the default tab plus the
 * definition's tab summary; selecting another tab fetches just that tab. Only the visible tab's
 * widgets trigger data requests, and stale results are isolated on switch (SWR keys include
 * patient + model + tab).
 */
export function ModelWorkspace({ patientUuid, model }: { patientUuid: string; model: CareModelMembership }) {
  const { t } = useTranslation();
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const {
    data: workspace,
    error,
    isLoading,
    mutate,
  } = useWorkspaceTab(patientUuid, model.modelCode, activeTabId, model.memberUuid);

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title={t('careModelsWorkspaceError', 'This care model could not be opened')}
        subtitle={t('careModelsWorkspaceErrorSubtitle', 'Its configuration may be unavailable or your access may have changed.')}
        hideCloseButton>
        <Button kind="tertiary" size="sm" onClick={() => void mutate()}>
          {t('retry', 'Retry')}
        </Button>
      </InlineNotification>
    );
  }

  if (isLoading || !workspace) {
    return <SkeletonPlaceholder className={styles.skeleton} />;
  }

  // Never render stale content from a previous inner tab while the new tab is loading.
  if (activeTabId && workspace.tabId !== activeTabId) {
    return <SkeletonPlaceholder className={styles.skeleton} />;
  }

  const tabs: Array<TabSummary> =
    workspace.tabs && workspace.tabs.length > 0 ? workspace.tabs : [{ id: workspace.tabId, label: workspace.tabLabel }];

  return (
    <Tabs
      selectedIndex={Math.max(
        0,
        tabs.findIndex((tab) => tab.id === (activeTabId ?? workspace.tabId)),
      )}
      onChange={(state) => setActiveTabId(tabs[state.selectedIndex]?.id ?? null)}>
      <TabList aria-label={t('innerTabs', 'Sections')}>
        {tabs.map((tab) => (
          <Tab key={tab.id}>{tab.label || tab.id}</Tab>
        ))}
      </TabList>
      <TabPanels>
        {tabs.map((tab) => (
          <TabPanel key={tab.id}>
            {/* only the visible tab's panel mounts its widgets */}
            {tab.id === (activeTabId ?? workspace.tabId) ? (
              <VisibleWidgets patientUuid={patientUuid} modelCode={model.modelCode} tab={workspace} />
            ) : null}
          </TabPanel>
        ))}
      </TabPanels>
    </Tabs>
  );
}

function VisibleWidgets({
  patientUuid,
  modelCode,
  tab,
}: {
  patientUuid: string;
  modelCode: string;
  tab: NonNullable<ReturnType<typeof useWorkspaceTab>['data']>;
}) {
  if (!tab.widgets?.length) {
    return <EmptyWidgets />;
  }
  return (
    <WorkspaceDescriptorContext.Provider value={tab.descriptors}>
      <div className={styles.widgetGrid}>
        {tab.widgets.map((widget) => (
          <DeferredWidget
            key={widget.id}
            widget={widget}
            patientUuid={patientUuid}
            modelCode={modelCode}
            tabId={tab.tabId}
            layouts={tab.layouts}
          />
        ))}
      </div>
    </WorkspaceDescriptorContext.Provider>
  );
}

function EmptyWidgets() {
  const { t } = useTranslation();
  return <p className={styles.emptyState}>{t('emptyWorkspaceTab', 'No content in this section.')}</p>;
}

export function DeferredWidget({
  widget,
  patientUuid,
  modelCode,
  tabId,
  layouts,
}: {
  widget: WidgetInstance;
  patientUuid: string;
  modelCode: string;
  tabId: string;
  layouts?: WorkspaceTab['layouts'];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    widget.loadingPolicy === 'EAGER' || typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  const wide = layouts?.wide?.find((item) => item.widgetId === widget.id) ?? widget.position;
  const narrow = layouts?.narrow?.find((item) => item.widgetId === widget.id);
  const position = (value: typeof wide) => {
    const col = Math.max(1, Math.min(12, Number(value?.col) || 1));
    return { col, w: Math.max(1, Math.min(13 - col, Number(value?.w) || 12)) };
  };
  const w = position(wide);
  const n = position(narrow);
  return (
    <div
      ref={ref}
      className={styles.widgetCell}
      style={
        {
          '--widget-row': wide ? `${wide.row + 1} / span ${wide.h}` : 'auto',
          '--narrow-row': narrow ? `${narrow.row + 1} / span ${narrow.h}` : 'auto',
          '--widget-col': w.col,
          '--widget-width': w.w,
          '--narrow-col': n.col,
          '--narrow-width': n.w,
        } as React.CSSProperties
      }>
      {visible ? (
        <WidgetRenderer widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />
      ) : (
        <SkeletonPlaceholder className={styles.skeleton} />
      )}
    </div>
  );
}
