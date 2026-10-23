import React, { useCallback } from 'react';
import { OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2 } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

/**
 * Patient-actions rail entry ("extreme right" menu) for Care Model enrollment. It opens the same
 * registered care-model-enrollment workspace as the dashboard button, with the chart's own
 * patient context; enrollment permission is enforced by the extension's privileges registration.
 */
export default function CareModelEnrollmentLauncher({
  patient,
  closeMenu,
}: {
  patientUuid?: string;
  patient?: fhir.Patient;
  closeMenu?: () => void;
}) {
  const { t } = useTranslation();
  const launch = useCallback(() => launchWorkspace2('care-model-enrollment'), []);

  return (
    patient && (
      <OverflowMenuItem
        itemText={t('enrollInCareModel', 'Enroll in a care model')}
        onClick={launch}
        closeMenu={closeMenu}
      />
    )
  );
}
