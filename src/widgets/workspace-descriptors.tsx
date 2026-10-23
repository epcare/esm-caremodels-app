import React, { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import type { WidgetInstance, WorkspaceDescriptors } from '../types/caremodels';
import { formatClinicalDate } from './clinical-format';
import styles from './widgets.scss';
export const WorkspaceDescriptorContext = createContext<WorkspaceDescriptors | undefined>(undefined);
export function CarePlanWidget({ widget }: { widget: WidgetInstance }) {
  const { t } = useTranslation();
  const pathway = useContext(WorkspaceDescriptorContext)?.pathway;
  return (
    <section className={styles.recordCard}>
      <p className={styles.widgetTitle}>{String(widget.properties?.title ?? t('carePlan', 'Care plan'))}</p>
      {pathway?.status === 'recorded' ? (
        <>
          <p>{pathway.label ?? pathway.stage}</p>
          <p>
            {t('stageEntered', 'Stage entered')}: {formatClinicalDate(pathway.enteredAt)}
          </p>
        </>
      ) : (
        <p>{String(widget.properties?.emptyText ?? t('noRecordedPathway', 'No recorded pathway stage available.'))}</p>
      )}
    </section>
  );
}
