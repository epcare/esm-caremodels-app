import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRConfig } from 'swr';
import { usePatientUuid } from '../utils/use-patient-uuid';
import { InlineNotification } from '@carbon/react';
import { hasMasterPrivilege, useMemberships, useSession } from '../api/caremodels.resource';
import type { CareModelMembership } from '../types/caremodels';
import { ModelCards } from './model-cards.component';
import { ModelWorkspace } from './inner-tabs.component';
import styles from './care-models-summary.scss';

/**
 * Care Models chart section (designs 1–3): model cards row, then the selected model's workspace
 * with its inner tabs. The ONLY outer-tab source is the authorized membership response. Without
 * the master privilege nothing mounts and no Care Models request is made.
 */
export default function CareModelsPatientSummary({ patientUuid: providedUuid }: { patientUuid?: string }) {
  const patientUuid = usePatientUuid(providedUuid);
  const { t } = useTranslation();
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession();

  if (sessionLoading) {
    return <p className={styles.emptyState}>{t('loading', 'Loading…')}</p>;
  }

  // no privilege, no mount, no requests: the server would deny them anyway
  if (sessionError || !hasMasterPrivilege(session)) {
    return null;
  }

  return (
    <div className={styles.container}>
      <p className={styles.heading}>{t('careModels', 'Care Models')}</p>
      <p className={styles.subtitle}>{t('careModelsSubtitle', 'Care models this patient is enrolled in')}</p>
      <SWRConfig key={`${session?.user?.uuid}:${patientUuid}`} value={{ provider: () => new Map() }}>
        <CareModelsBoard patientUuid={patientUuid} />
      </SWRConfig>
    </div>
  );
}

function CareModelsBoard({ patientUuid }: { patientUuid: string | null }) {
  const { t } = useTranslation();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const { data: memberships, error, isLoading } = useMemberships(patientUuid, Boolean(patientUuid));

  if (!patientUuid)
    return (
      <p className={styles.emptyState}>{t('patientContextUnavailable', 'Open a patient chart to view care models.')}</p>
    );

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title={t('careModelsLoadError', 'Could not load Care Models')}
        subtitle={t('careModelsLoadErrorSubtitle', 'You may not be authorized, or the service is unavailable.')}
        hideCloseButton
      />
    );
  }

  if (isLoading) {
    return <p className={styles.emptyState}>{t('loading', 'Loading…')}</p>;
  }

  const models: Array<CareModelMembership> = memberships ?? [];

  if (models.length === 0) {
    return (
      <p className={styles.emptyState}>
        {t('noEnrolledCareModels', 'This patient is not enrolled in any care model.')}
      </p>
    );
  }

  const selected = models.find((model) => model.modelCode === selectedCode) ?? models[0];

  return (
    <>
      <ModelCards
        models={models.map((model) => ({
          modelUuid: model.modelUuid,
          modelCode: model.modelCode,
          displayLabel: model.displayLabel || model.modelName,
          status: 'Active',
          since: model.dateEnrolled ? formatDate(model.dateEnrolled) : undefined,
        }))}
        selectedCode={selected.modelCode}
        onSelect={setSelectedCode}
      />
      <ModelWorkspace key={`${patientUuid}:${selected.modelUuid}`} patientUuid={patientUuid ?? ''} model={selected} />
    </>
  );
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}
