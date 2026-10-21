import React from 'react';
import { InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { WidgetInstance } from '../types/caremodels';
import styles from './widgets.scss';

/** Static content is text, never HTML, and cannot execute a clinical request. */
export function StaticWidget({ widget }: { widget: WidgetInstance }) {
  const { t } = useTranslation();
  const props = widget.properties ?? {};
  const text = String(props.text ?? '');
  switch (widget.type) {
    case 'text-note':
      return <p className={styles.staticText}>{text}</p>;
    case 'section-heading': {
      const Heading = `h${Number(props.level ?? 2)}` as 'h2';
      return <Heading>{text}</Heading>;
    }
    case 'divider':
      return (
        <div
          role="separator"
          aria-orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'}
          className={props.orientation === 'vertical' ? styles.verticalDivider : styles.divider}
        />
      );
    case 'spacer':
      return <div aria-hidden="true" className={styles[`spacer${String(props.size ?? 'medium')}`]} />;
    case 'static-callout':
      return (
        <InlineNotification
          lowContrast
          hideCloseButton
          kind={(props.tone ?? 'info') as 'info'}
          title={String(props.title ?? t('staticGuidance', 'Static guidance'))}
          subtitle={text}
        />
      );
    default:
      return null;
  }
}
