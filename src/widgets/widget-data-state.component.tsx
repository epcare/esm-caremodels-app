import React from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { isAuthorizationError } from '../api/contract';
import type { DataResult } from '../types/caremodels';

export function WidgetDataState({
  error,
  isLoading,
  data,
  emptyMessage,
}: {
  error?: unknown;
  isLoading: boolean;
  data?: DataResult;
  emptyMessage: string;
}) {
  const { t } = useTranslation();
  if (error)
    return (
      <InlineNotification
        kind={isAuthorizationError(error) ? 'warning' : 'error'}
        lowContrast
        hideCloseButton
        title={
          isAuthorizationError(error)
            ? t('widgetUnauthorized', 'You no longer have access to this clinical information')
            : t('dataUnavailable', 'Data unavailable')
        }
      />
    );
  if (isLoading) return <SkeletonText aria-label={t('loading', 'Loading…')} />;
  if (!data?.values?.length) return <p>{emptyMessage}</p>;
  return null;
}
