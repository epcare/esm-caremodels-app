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
import { LatestSetResultsWidget } from './latest-set-results.component';
import { SetHistoryTrendsWidget } from './set-history-trends.component';
import { CarePlanWidget } from './workspace-descriptors';
import { RecordWidget } from './record-widget.component';
import { StaticWidget } from './static-widget.component';
import { isStaticWidget, widgetPropertyErrors } from './widget-properties';

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

  const propertyErrors = widgetPropertyErrors(widget);
  if (propertyErrors.length)
    return (
      <InlineNotification
        kind="warning"
        lowContrast
        hideCloseButton
        title={t('invalidWidgetConfig', 'Invalid configuration')}
        subtitle={propertyErrors.join('\n')}
      />
    );

  if (isStaticWidget(widget)) return <StaticWidget widget={widget} />;

  if (
    [
      'metric',
      'clinical-table',
      'trend-chart',
      'timeline',
      'condition-list',
      'medication-summary',
      'program-summary',
      'patient-summary',
      'latest-set-results',
      'set-history-trends',
    ].includes(widget.type) &&
    !widget.dataSource &&
    !(widget.type === 'trend-chart' && widget.dataSources?.length)
  ) {
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
    case 'care-plan':
      return <CarePlanWidget widget={widget} />;
    case 'condition-list':
    case 'medication-summary':
    case 'program-summary':
    case 'patient-summary':
      return <RecordWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'metric':
      return <MetricWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'clinical-table':
      return <ClinicalTableWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'trend-chart':
      return <TrendChartWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'timeline':
      return <TimelineWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'latest-set-results':
      return <LatestSetResultsWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
    case 'set-history-trends':
      return <SetHistoryTrendsWidget widget={widget} patientUuid={patientUuid} modelCode={modelCode} tabId={tabId} />;
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
