import React, { useEffect, useRef, useState } from 'react';
import { Button, InlineLoading, InlineNotification, Stack } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { Ace } from 'ace-builds';
import styles from './designer.scss';

/** JSON-only Ace loaded on demand; no workers, language bundles or external asset requests. */
export function DefinitionJsonEditor({
  value,
  errors,
  onChange,
  onDiscard,
  disabled,
}: {
  value: string;
  errors: Array<string>;
  onChange: (value: string) => void;
  onDiscard: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const editorLabel = useRef(t('definitionJson', 'Definition JSON'));
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Ace.Editor>();
  const syncing = useRef(false);
  const change = useRef(onChange);
  change.current = onChange;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const initial = useRef(value);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ace = await import('ace-builds/src-noconflict/ace');
      await import('ace-builds/src-noconflict/mode-json');
      await import('ace-builds/src-noconflict/ext-searchbox');
      if (cancelled || !host.current) return;
      const instance = ace.edit(host.current);
      instance.session.setUseWorker(false);
      instance.session.setMode('ace/mode/json');
      instance.setOptions({
        fontSize: 14,
        showPrintMargin: false,
        tabSize: 2,
        useSoftTabs: true,
        showGutter: true,
        showLineNumbers: true,
      });
      instance.setValue(initial.current, -1);
      instance.textInput.getElement().setAttribute('aria-label', editorLabel.current);
      instance.session.on('change', () => {
        if (!syncing.current) change.current(instance.getValue());
      });
      editor.current = instance;
      setReady(true);
    })().catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => {
      cancelled = true;
      editor.current?.destroy();
      editor.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (editor.current && editor.current.getValue() !== value) {
      syncing.current = true;
      editor.current.setValue(value, -1);
      syncing.current = false;
    }
  }, [value, ready]);
  useEffect(() => {
    editor.current?.setReadOnly(disabled);
  }, [disabled, ready]);
  useEffect(() => {
    editor.current?.session.setAnnotations(
      errors.map((text) => {
        const position = text.match(/line (\d+), column (\d+)/);
        return {
          row: position ? Number(position[1]) - 1 : 0,
          column: position ? Number(position[2]) - 1 : 0,
          text,
          type: 'error',
        };
      }),
    );
  }, [errors, ready]);
  return (
    <Stack gap={4}>
      <div className={styles.editorTools}>
        <Button
          kind="tertiary"
          size="sm"
          disabled={!ready || disabled || Boolean(errors.length)}
          onClick={() => onChange(JSON.stringify(JSON.parse(value), null, 2))}>
          {t('formatJson', 'Format JSON')}
        </Button>
        <Button kind="ghost" size="sm" disabled={!ready} onClick={() => editor.current?.execCommand('find')}>
          {t('searchJson', 'Search JSON')}
        </Button>
        <Button kind="ghost" size="sm" disabled={!ready} onClick={() => editor.current?.execCommand('foldall')}>
          {t('foldJson', 'Collapse all')}
        </Button>
        <Button kind="ghost" size="sm" disabled={!ready} onClick={() => editor.current?.execCommand('unfoldall')}>
          {t('unfoldJson', 'Expand all')}
        </Button>
        <Button kind="ghost" size="sm" disabled={disabled} onClick={onDiscard}>
          {t('discardJsonBuffer', 'Reset to current draft')}
        </Button>
      </div>
      {!ready && !loadError && <InlineLoading description={t('loadingJsonEditor', 'Loading JSON editor…')} />}
      {loadError && (
        <InlineNotification
          kind="error"
          title={t('jsonEditorLoadError', 'Could not load the JSON editor. Reopen this view to retry.')}
          hideCloseButton
        />
      )}
      <div ref={host} className={styles.jsonEditor} />
      {errors.length > 0 && (
        <InlineNotification
          kind="error"
          title={t('jsonNotApplied', 'JSON changes have not been applied')}
          subtitle={errors.join('\n')}
          hideCloseButton
        />
      )}
    </Stack>
  );
}
