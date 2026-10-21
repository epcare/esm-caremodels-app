import React from 'react';
import { useTranslation } from 'react-i18next';
import { Group } from '@carbon/react/icons';
import { Tag } from '@carbon/react';
import styles from './care-models-summary.scss';

/**
 * Model cards row (designs 1–3): one card per ACTIVE enrollment — category icon, display label,
 * status tag, enrollment date and current episode. No history is synthesized.
 */
export interface ModelCardModel {
  modelUuid: string;
  modelCode: string;
  displayLabel: string;
  status: 'Active' | 'Past';
  since?: string;
  episodeCount?: number;
  episodeNumber?: number;
}

export function ModelCards({
  models,
  selectedCode,
  onSelect,
}: {
  models: Array<ModelCardModel>;
  selectedCode: string | null;
  onSelect: (modelCode: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.cardRow} role="group" aria-label={t('careModelsTabs', 'Care models')}>
      {models.map((model) => (
        <button
          key={model.modelUuid}
          type="button"
          aria-pressed={model.modelCode === selectedCode}
          className={`${styles.card} ${model.modelCode === selectedCode ? styles.cardSelected : ''}`}
          onClick={() => onSelect(model.modelCode)}>
          <span className={styles.cardIcon} aria-hidden>
            <Group size={32} />
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardTitle}>{model.displayLabel}</span>
            {model.status === 'Active' ? (
              <Tag type="green" size="sm" className={styles.cardTag}>
                {t('active', 'Active')}
              </Tag>
            ) : (
              <Tag type="cool-gray" size="sm" className={styles.cardTag}>
                {t('completed', 'Completed')}
              </Tag>
            )}
            <span className={styles.cardMeta}>
              {model.status === 'Active'
                ? model.since
                  ? t('sinceDate', 'Since {{date}}', { date: model.since })
                  : t('enrollmentDateUnavailable', 'Enrollment date unavailable')
                : t('episodeCount', '{{count}} episodes', { count: model.episodeCount ?? 0 })}
            </span>
            {model.status === 'Active' && model.episodeNumber !== undefined && (
              <span className={styles.cardMeta}>
                {t('enrollmentEpisode', 'Episode {{number}}', { number: model.episodeNumber })}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
