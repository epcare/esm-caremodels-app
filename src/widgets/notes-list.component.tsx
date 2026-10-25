import React from 'react';
import { Accordion, AccordionItem, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useWidgetData } from '../api/caremodels.resource';
import type { WidgetInstance } from '../types/caremodels';
import { WidgetDataState } from './widget-data-state.component';
import { formatClinicalDate, formatClinicalValue } from './clinical-format';
import styles from './widgets.scss';

const PREVIEW_CHARS = 80;

/**
 * Clinical Notes: the most recent text observations as an accordion — the date and a short
 * preview stay visible while the full note stays collapsed, so bulky text never dominates the
 * tab. Text is rendered verbatim; the count cap comes from the bound source's maxResults and
 * this widget's own visible limit.
 */
export function NotesListWidget({
  widget,
  patientUuid,
  modelCode,
  tabId,
}: {
  widget: WidgetInstance;
  patientUuid: string;
  modelCode: string;
  tabId: string;
}) {
  const { t } = useTranslation();
  const { data, error, isLoading, retry } = useWidgetData(patientUuid, modelCode, tabId, widget.dataSource ?? null);
  const properties = widget.properties ?? {};
  const maxVisible = Math.max(1, Math.min(50, Number(properties.maxVisible) || 5));
  const showPreview = properties.showPreview !== false;
  const notes = (data?.values ?? []).slice(0, maxVisible);
  const hidden = (data?.values?.length ?? 0) - notes.length;
  const title = String(properties.title ?? widget.id);

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.chartHeader}>
        <h4 className={styles.widgetTitle}>{title}</h4>
      </div>
      {Boolean(properties.subtitle) && <p className={styles.widgetSubtitle}>{String(properties.subtitle)}</p>}
      {Boolean(properties.description) && <p className={styles.widgetSubtitle}>{String(properties.description)}</p>}
      {error || isLoading || !notes.length ? (
        <WidgetDataState
          error={error}
          isLoading={isLoading}
          data={data}
          emptyMessage={String(
            properties.emptyMessage || properties.emptyText || t('noNotes', 'No notes recorded'),
          )}
          onRetry={retry}
        />
      ) : (
        <>
          <Accordion size="md" align="start">
            {notes.map((note) => {
              const text = formatClinicalValue(note);
              const preview =
                text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
              return (
                <AccordionItem
                  key={note.obsUuid}
                  title={
                    <>
                      <span className={styles.noteDate}>{formatClinicalDate(note.effectiveTime)}</span>
                      {showPreview && <span className={styles.notePreview}>{preview}</span>}
                    </>
                  }>
                  <p className={styles.noteBody}>{text}</p>
                </AccordionItem>
              );
            })}
          </Accordion>
          {hidden > 0 && (
            <p className={styles.sectionHint}>
              <Tag size="sm" type="gray">
                {t('notesHidden', '{{count}} older notes not shown', { count: hidden })}
              </Tag>
            </p>
          )}
        </>
      )}
    </div>
  );
}
