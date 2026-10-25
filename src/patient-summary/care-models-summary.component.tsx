import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRConfig } from 'swr';
import { usePatientUuid } from '../utils/use-patient-uuid';
import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import {
  hasEnrollmentPrivilege,
  hasMasterPrivilege,
  useMemberships,
  useSession,
} from '../api/caremodels.resource';
import { isAuthorizationError } from '../api/contract';
import type { CareModelMembership } from '../types/caremodels';
import { MembershipControls } from './enrollment-controls.component';
import { launchEnrollmentWorkspace } from './enrollment-workspace.component';
import { ModelCards } from './model-cards.component';
import { ModelWorkspace } from './inner-tabs.component';
import styles from './care-models-summary.scss';

/**
 * Care Models chart section (designs 1–3): model cards row, then the selected model's workspace
 * with its inner tabs. The ONLY outer-tab source is the authorized membership response. Without
 * the master privilege the direct page shows an access message and makes no Care Models request.
 */
export default function CareModelsPatientSummary({ patientUuid: providedUuid }: { patientUuid?: string }) {
  const patientUuid = usePatientUuid(providedUuid);
  const { t } = useTranslation();
  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
    mutate: refreshSession,
  } = useSession();

  if (sessionLoading) {
    return <SkeletonText aria-label={t('loading', 'Loading…')} />;
  }

  if (sessionError) {
    return (
      <div className={styles.container}>
        <p className={styles.heading}>{t('careModels', 'Care Models')}</p>
        <InlineNotification
          kind="error"
          lowContrast
          title={t('careModelsSessionError', 'Could not verify Care Models access')}
          subtitle={t('careModelsSessionErrorSubtitle', 'Retry to check your access, then reload this page.')}
          hideCloseButton>
          <Button kind="tertiary" size="sm" onClick={() => void refreshSession()}>
            {t('retry', 'Retry')}
          </Button>
        </InlineNotification>
      </div>
    );
  }

  // Keep navigation privilege-gated while making direct URL access explain the restriction.
  // No membership, workspace, or clinical request is made without the master privilege.
  if (!hasMasterPrivilege(session)) {
    return (
      <div className={styles.container}>
        <p className={styles.heading}>{t('careModels', 'Care Models')}</p>
        <InlineNotification
          kind="warning"
          lowContrast
          title={t('careModelsAccessDenied', 'Care Models access is required')}
          subtitle={t(
            'careModelsAccessDeniedSubtitle',
            'You do not have the View Care Models privilege. Contact your administrator if you need access.',
          )}
          hideCloseButton
        />
      </div>
    );
  }

  return (
    // The model cards and workspace speak for themselves; no visible heading when models load.
    <div className={styles.container} aria-label={t('careModels', 'Care Models')}>
      <SWRConfig key={`${session?.user?.uuid}:${patientUuid}`} value={{ provider: () => new Map() }}>
        <CareModelsBoard patientUuid={patientUuid} canEnroll={hasEnrollmentPrivilege(session)} />
      </SWRConfig>
    </div>
  );
}

function CareModelsBoard({ patientUuid, canEnroll }: { patientUuid: string | null; canEnroll: boolean }) {
  const { t } = useTranslation();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const {
    data: memberships,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useMemberships(patientUuid, Boolean(patientUuid));
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      await mutate();
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (memberships && !memberships.some((model) => model.modelCode === selectedCode)) {
      setSelectedCode(memberships[0]?.modelCode ?? null);
    }
  }, [memberships, selectedCode]);

  if (!patientUuid)
    return (
      <p className={styles.emptyState}>{t('patientContextUnavailable', 'Open a patient chart to view care models.')}</p>
    );

  const controls = (
    <MembershipControls
      refreshing={refreshing || Boolean(isLoading || isValidating)}
      onRefresh={() => void refresh()}
      onEnroll={canEnroll && patientUuid ? () => launchEnrollmentWorkspace(patientUuid) : undefined}
    />
  );
  // Section title and enrollment actions share one header line; the model selection follows below.
  const header = (
    <div className={styles.sectionHeader}>
      <h3 className={styles.heading}>{t('patientsCareModels', "Patient's Care Models")}</h3>
      {controls}
    </div>
  );
  if (error || refreshFailed) {
    return (
      <>
        {header}
        <InlineNotification
          kind={isAuthorizationError(error) ? 'warning' : 'error'}
          lowContrast
          title={
            isAuthorizationError(error)
              ? t('careModelsAccessUnavailable', 'Care Models are unavailable for this patient')
              : t('careModelsLoadError', 'Could not load Care Models')
          }
          subtitle={
            isAuthorizationError(error)
              ? t('careModelsAccessUnavailableSubtitle', 'Your access may have changed. Refresh or contact an administrator.')
              : t('careModelsLoadErrorSubtitle', 'The service is unavailable. Use Refresh enrollments to try again.')
          }
          hideCloseButton
        />
      </>
    );
  }
  if (isLoading)
    return (
      <>
        {header}
        <SkeletonText aria-label={t('loading', 'Loading…')} />
      </>
    );
  const models: Array<CareModelMembership> = memberships
    ? [...memberships].sort((a, b) =>
        a.displayOrder !== undefined && b.displayOrder !== undefined ? a.displayOrder - b.displayOrder : 0,
      )
    : [];
  if (!models.length)
    return (
      <>
        {header}
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('noAuthorizedCareModels', 'No care models available')}
          subtitle={t(
            'noAuthorizedCareModelsSubtitle',
            'There are no care models available for you to view for this patient.',
          )}
        />
      </>
    );
  const selected = models.find((model) => model.modelCode === selectedCode) ?? models[0];
  return (
    <>
      {header}
      <ModelCards
        models={models.map((model) => ({
          modelUuid: model.modelUuid,
          modelCode: model.modelCode,
          displayLabel: model.displayLabel || model.modelName,
          status: 'Active',
          episodeNumber: model.episodeNumber,
          since: model.dateEnrolled ? formatDate(model.dateEnrolled) : undefined,
        }))}
        selectedCode={selected.modelCode}
        onSelect={setSelectedCode}
      />
      <ModelWorkspace key={`${patientUuid}:${selected.memberUuid}`} patientUuid={patientUuid} model={selected} />
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
