import React from 'react';
import { ComboBox, InlineLoading, InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { usePrivileges } from '../api/caremodels.resource';

export function PrivilegeSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = usePrivileges();
  if (isLoading) return <InlineLoading description={t('loadingPrivileges', 'Loading OpenMRS privileges…')} />;
  if (error)
    return (
      <InlineNotification
        kind="error"
        title={t('privilegesLoadError', 'Could not load OpenMRS privileges')}
        hideCloseButton
      />
    );
  return (
    <ComboBox
      id="model-privilege"
      titleText={t('requiredPrivilege', 'Required viewing privilege')}
      items={data ?? []}
      selectedItem={value || null}
      onChange={({ selectedItem }) => onChange(selectedItem ?? '')}
      helperText={t(
        'distinctPrivilege',
        'Choose a registered model-specific privilege. The master privilege is excluded.',
      )}
    />
  );
}
