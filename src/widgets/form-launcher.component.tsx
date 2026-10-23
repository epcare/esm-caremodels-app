import React, { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { Button } from '@carbon/react';
import { Document } from '@carbon/react/icons';
import { launchWorkspace2, showModal } from '@openmrs/esm-framework';
import * as frameworkApi from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { WorkspaceDescriptorContext } from './workspace-descriptors';
import type { WidgetInstance } from '../types/caremodels';
import styles from './widgets.scss';

/**
 * Emulates the patient chart's own launch discipline (esm-patient-common-lib workspaces.ts):
 * the active visit comes from the chart's patient-chart-global-store, and no form is launched
 * without a known visit context — when the visit is missing, the chart's start-visit dialog is
 * offered first and the form launches only after the workspace group carries the new visit.
 */
interface ChartVisit {
  uuid?: string;
  display?: string;
  startDatetime?: string;
  stopDatetime?: string | null;
  visitType?: { uuid?: string; display?: string };
}

interface PatientChartStoreState {
  patientUuid?: string | null;
  visitContext?: ChartVisit | null;
  workspaceGroupVisitUuid?: string | null;
  mutateVisitContext?: (() => void) | null;
}

interface Store<T> {
  getState: () => T;
  subscribe: (listener: () => void) => () => void;
}

const getPatientChartStore = (
  frameworkApi as { getGlobalStore?: <T>(name: string, initial: T) => Store<T> }
).getGlobalStore;
const emptyChartStore: PatientChartStoreState = {};

function usePatientChartStore(patientUuid: string): PatientChartStoreState {
  const store = useMemo(
    () => getPatientChartStore?.<PatientChartStoreState>('patient-chart-global-store', emptyChartStore) ?? null,
    [],
  );
  const subscribe = useCallback(
    (listener: () => void) => store?.subscribe(listener) ?? (() => () => {}),
    [store],
  );
  const state = useSyncExternalStore(subscribe, () => store?.getState() ?? emptyChartStore, () => emptyChartStore);
  // Same safety rule as the chart's usePatientChartStore: only trust the store for this patient.
  return state.patientUuid === patientUuid ? state : emptyChartStore;
}

/** Authorized form descriptor as published by the workspace API. */
interface FormDescriptor {
  available?: boolean;
  formUuid?: string;
  name?: string;
  version?: string;
  encounterTypeUuid?: string;
  encounterTypeName?: string;
}

/** Workspace props of the chart's patient-form-entry-workspace (esm-patient-forms-app). */
function toWorkspaceForm(descriptor: FormDescriptor) {
  return {
    uuid: descriptor.formUuid!,
    name: descriptor.name ?? descriptor.formUuid!,
    display: descriptor.name ?? descriptor.formUuid!,
    version: descriptor.version ?? '',
    published: true,
    retired: false,
    resources: [],
    ...(descriptor.encounterTypeUuid
      ? {
          encounterType: {
            uuid: descriptor.encounterTypeUuid,
            name: descriptor.encounterTypeName ?? descriptor.encounterTypeUuid,
          },
        }
      : {}),
  };
}

/** Raw workspace widgets contain an alias, not an authorized resolved form reference. */
export function FormLauncherWidget({ widget, patientUuid }: { widget: WidgetInstance; patientUuid: string }) {
  const { t } = useTranslation();
  const label = String(widget.properties?.title ?? t('openForm', 'Open form'));
  const descriptors = useContext(WorkspaceDescriptorContext)?.forms ?? [];
  const chart = usePatientChartStore(patientUuid);
  const aliases = [...new Set([widget.formAlias, ...(widget.formAliases ?? [])].filter(Boolean))] as Array<string>;
  const buttons = aliases.length ? aliases : [''];

  const launchOnceVisitKnown = useCallback(
    (descriptor: FormDescriptor, visit: ChartVisit | null | undefined) => {
      if (!visit?.uuid) return;
      launchWorkspace2('patient-form-entry-workspace', { form: toWorkspaceForm(descriptor) });
    },
    [],
  );

  const launchForm = useCallback(
    (descriptor: FormDescriptor) => {
      const { visitContext, workspaceGroupVisitUuid } = chart;
      if (visitContext?.uuid) {
        launchOnceVisitKnown(descriptor, visitContext);
        return;
      }
      // The chart's own gate: offer to start a visit, then launch only once the workspace
      // group has been relaunched with the new visit context.
      let dispose: () => void;
      const waitForVisitContext = (onReady: () => void) => {
        if (!getPatientChartStore) return;
        const store = getPatientChartStore<PatientChartStoreState>('patient-chart-global-store', emptyChartStore);
        const unsubscribe = store.subscribe(() => {
          const next = store.getState();
          if (next.patientUuid === patientUuid && next.visitContext?.uuid) {
            if (next.workspaceGroupVisitUuid == null || next.workspaceGroupVisitUuid === next.visitContext.uuid) {
              unsubscribe();
              onReady();
            }
          }
        });
      };
      dispose = showModal('start-visit-dialog', {
        patientUuid,
        closeModal: () => dispose?.(),
        onCancel: () => dispose?.(),
        onVisitStarted: () => waitForVisitContext(() => {
          const store = getPatientChartStore?.<PatientChartStoreState>('patient-chart-global-store', emptyChartStore);
          launchOnceVisitKnown(descriptor, store?.getState().visitContext);
        }),
      });
    },
    [chart, launchOnceVisitKnown, patientUuid],
  );

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
        if (descriptor?.available && descriptor?.formUuid) {
          const visitHint = chart.visitContext?.uuid
            ? t('formLaunchVisitHint', 'Saves to the current visit: {{visit}}', {
                visit: chart.visitContext.display ?? chart.visitContext.uuid,
              })
            : t('visitContextRequired', 'No active visit. You will be asked to start one first.');
          return (
            <div key={alias} className={styles.formRow}>
              <Document className={styles.formIcon} aria-hidden="true" />
              <span className={styles.formName}>{descriptor.name ?? (alias || label)}</span>
              <Button
                kind="tertiary"
                size="sm"
                title={visitHint}
                onClick={() => launchForm(descriptor)}>
                {String(widget.properties?.buttonLabel || t('openForm', 'Open form'))}
              </Button>
            </div>
          );
        }
        const reason = descriptor?.reason
          ? t(`capabilityReason.${descriptor.reason}`, descriptor.reason)
          : t('formMetadataUnavailable', 'The workspace API has not supplied a resolved form reference.');
        return (
          <div key={alias} className={styles.formRow}>
            <Document className={styles.formIcon} aria-hidden="true" />
            <span className={styles.formName}>{descriptor?.name ?? (alias || label)}</span>
            <Button kind="tertiary" size="sm" disabled title={reason}>
              {String(widget.properties?.buttonLabel || t('openForm', 'Open form'))}
            </Button>
            <span className={styles.formReason}>{reason}</span>
          </div>
        );
      })}
    </div>
  );
}
