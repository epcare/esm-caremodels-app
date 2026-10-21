import React from 'react';
import { InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { WidgetInstance } from '../types/caremodels';
import { MetricWidget } from './metric.component';
import { ClinicalTableWidget } from './clinical-table.component';
import { FormLauncherWidget } from './form-launcher.component';
import { ActionPanelWidget } from './action-panel.component';
import { TrendChartWidget } from './trend-chart.component';
import { TimelineWidget } from './timeline.component';
import styles from './widgets.scss';

/**
 * Widget manifest dispatch. Every widget type here is a registered render component; unknown
 * types (which the backend validator rejects anyway) render an invalid-configuration state
 * instead of crashing the chart.
 */
export function WidgetRenderer({
  widget,
  patientUuid,
  modelCode,
  tabId,
}: {
  widget: WidgetInstance;
  patientUuid: string;
  modelCode: string;
  tabId: string;
}) {
  const { t } = useTranslation();

  if (['metric', 'clinical-table', 'trend-chart', 'timeline'].includes(widget.type) && !widget.dataSource) {
    return (
      <InlineNotification
        kind="warning"
        title={t('invalidWidgetConfig', 'Invalid configuration')}
        subtitle={t('missingSourceBinding', 'This widget has no configured data source.')}
        hideCloseButton
      />
    );
  }

  switch (widget.type) {
    case 'metric':
      return <MetricWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'clinical-table':
      return <ClinicalTableWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'trend-chart':
      return <TrendChartWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'timeline':
      return <TimelineWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'form-launcher':
      return <FormLauncherWidget widget={widget} patientUuid={patientUuid} />;
    case 'action-panel':
      return <ActionPanelWidget widget={widget} />;
    default:
      return (
        <InlineNotification
          kind="warning"
          lowContrast
          title={t('invalidWidgetConfig', 'Invalid configuration')}
          subtitle={t('unknownWidgetType', 'This widget type is not registered')}
          hideCloseButton
        />
      );
  }
}
