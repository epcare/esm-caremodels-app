import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionMenuButton2 } from '@openmrs/esm-framework';
import { HealthCross } from '@carbon/react/icons';

/**
 * Extreme-right patient-chart rail button for Care Model enrollment. Rendered through the
 * workspace window system (workspaceWindows2 + ActionMenuButton2), so patient context comes
 * from the chart's workspace group and the tooltip follows the standard rail styling.
 */
export default function CareModelEnrollmentLauncherButton() {
  const { t } = useTranslation();

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof HealthCross>) => <HealthCross {...props} />}
      label={t('enrollInCareModel', 'Enroll in a care model')}
      workspaceToLaunch={{
        workspaceName: 'care-model-enrollment',
        workspaceProps: {},
      }}
    />
  );
}
