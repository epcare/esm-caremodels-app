import React from 'react';
import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { isAuthorizationError } from '../api/contract';
import type { DataResult } from '../types/caremodels';
import styles from './widgets.scss';

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
        className={styles.dataState}
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
  if (isLoading) return <SkeletonText className={styles.dataState} aria-label={t('loading', 'Loading…')} />;
  if (!data?.values?.length) return <p className={styles.dataState}>{emptyMessage}</p>;
  return null;
}
