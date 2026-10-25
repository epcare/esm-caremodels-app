import React, { useState } from 'react';
import { Button, FileUploaderButton, InlineNotification, Stack } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { ModelDefinition } from '../../../types/caremodels';
import { fetchForms, type OpenmrsForm } from '../../../api/caremodels.resource';
import { mergeWorkspaceUpdate } from '../../../configuration/merge-workspace-update.mjs';
import { parseDefinitionJson } from '../model/definition-validation';
import { widgetBindingErrors } from '../../../widgets/widget-registry';

/** Imports into the current draft, never into the new-model registry import operation. */
export function WorkspaceDefinitionImport({
  definition,
  onApply,
  disabled,
}: {
  definition: ModelDefinition;
  onApply: (definition: ModelDefinition) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [verifiedForms, setVerifiedForms] = useState<Array<OpenmrsForm>>([]);
  const [pending, setPending] = useState<ModelDefinition | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [applied, setApplied] = useState(false);
  return (
    <Stack gap={4}>
      <FileUploaderButton
        labelText={t('importWorkspaceUpdate', 'Import workspace update JSON')}
        accept={['.json']}
        multiple={false}
        disableLabelChanges
        disabled={disabled || reading}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setPending(null);
          setError('');
          setApplied(false);
          setReading(true);
          try {
            if (file.size > 2 * 1024 * 1024)
              throw new Error(t('workspaceImportTooLarge', 'The workspace update must be smaller than 2 MB.'));
            const parsed = parseDefinitionJson(await file.text());
            if (!parsed.definition) throw new Error(parsed.errors.join('\n'));
            const needsAssociation = parsed.definition.forms.some(
              (form) => !definition.forms.some((existing) => existing.formUuid === form.formUuid),
            );
            const catalog = needsAssociation ? await fetchForms() : [];
            const merged = mergeWorkspaceUpdate(definition, parsed.definition, { verifiedForms: catalog });
            setVerifiedForms(catalog);
            const checked = parseDefinitionJson(JSON.stringify(merged));
            const errors = [...checked.errors, ...widgetBindingErrors(merged)];
            if (errors.length) throw new Error(errors.join('\n'));
            setPending(parsed.definition);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setReading(false);
          }
        }}
      />
      {pending && (
        <>
          <p>
            {t(
              'workspaceImportReview',
              'Replace the workspace with {{tabs}} tabs. Existing enrollment policy, lifecycle, associated form UUIDs and model identity are preserved. Missing form associations are added only after verification against the OpenMRS form catalog. Changes remain local until Save draft.',
              { tabs: pending.workspace.tabs.length },
            )}
          </p>
          <Button
            kind="tertiary"
            disabled={disabled || reading}
            onClick={() => {
              try {
                const merged = mergeWorkspaceUpdate(definition, pending, { verifiedForms });
                const checked = parseDefinitionJson(JSON.stringify(merged));
                const errors = [...checked.errors, ...widgetBindingErrors(merged)];
                if (errors.length) throw new Error(errors.join('\n'));
                onApply(merged);
                setPending(null);
                setApplied(true);
                setError('');
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : String(failure));
              }
            }}>
            {t('applyWorkspaceUpdate', 'Apply workspace update')}
          </Button>
        </>
      )}
      {error && (
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t('workspaceImportRejected', 'Workspace update was not applied')}
          subtitle={error}
        />
      )}
      {applied && (
        <InlineNotification
          kind="info"
          hideCloseButton
          title={t(
            'workspaceImportApplied',
            'Workspace update applied locally. Validate and save the draft before publishing.',
          )}
        />
      )}
    </Stack>
  );
}
