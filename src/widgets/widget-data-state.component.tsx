import React from 'react';
import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { isAuthorizationError } from '../api/contract';
import type { DataResult } from '../types/caremodels';

export function WidgetDataState({
  error,
  isLoading,
  data,
  emptyMessage,
  onRetry,
}: {
  error?: unknown;
  isLoading: boolean;
  data?: DataResult;
  emptyMessage: string;
  onRetry?: () => void;
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
        }>
        {onRetry && (
          <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={onRetry}>
            {t('retry', 'Retry')}
          </Button>
        )}
      </InlineNotification>
    );
  if (isLoading) return <SkeletonText aria-label={t('loading', 'Loading…')} />;
  if (!data?.values?.length) return <p>{emptyMessage}</p>;
  return null;
}
