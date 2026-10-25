import { fetchEnvelope, fetchModel, fetchForms, saveDraft, validateDefinition } from '../api/caremodels.resource';
import { parseEnvelope } from '../api/contract';
import { mergeWorkspaceUpdate } from '../configuration/merge-workspace-update.mjs';
import { parseDefinitionJson } from './designer/model/definition-validation';
import { widgetBindingErrors } from '../widgets/widget-registry';

/** Existing-model workspace update: never use the backend's create-only envelope import. */
export async function importWorkspaceDraft(code: string, json: string) {
  const incoming = parseDefinitionJson(json);
  if (!incoming.definition) throw new Error(incoming.errors.join('\n'));
  let model;
  try {
    model = await fetchModel(code);
  } catch (error) {
    const failure = error as { status?: number; response?: { status?: number } } | null;
    if (failure?.status === 404 || failure?.response?.status === 404)
      throw new Error(
        `No existing Care Model was found for code "${code}". Use the exact code shown in the registry. This workspace import does not create or rename a model.`,
      );
    throw error;
  }
  if (model.code !== code || model.retired) throw new Error('Choose an existing, non-retired Care Model.');
  const response = await fetchEnvelope(model.code);
  const envelope = parseEnvelope(response.envelope);
  if (model.revision !== envelope.revision)
    throw new Error('The model changed while loading. Retry after reviewing its latest draft.');
  const base = (envelope.draft ?? envelope.published)!.definition;
  const needsAssociation = incoming.definition.forms.some(
    (form) => !base.forms.some((existing) => existing.formUuid === form.formUuid),
  );
  const verifiedForms = needsAssociation ? await fetchForms() : [];
  const definition = mergeWorkspaceUpdate(base, incoming.definition, { verifiedForms });
  const errors = [...parseDefinitionJson(JSON.stringify(definition)).errors, ...widgetBindingErrors(definition)];
  if (errors.length) throw new Error(errors.join('\n'));
  const validation = await validateDefinition(definition);
  if (validation.valid !== true || validation.validationErrors)
    throw new Error(validation.validationErrors || 'Backend validation did not confirm this workspace is valid.');
  const saved = await saveDraft(code, definition, envelope.revision);
  if (saved.conflict)
    throw new Error(
      `Revision conflict: current revision ${saved.currentRevision}. The imported JSON is preserved; review the latest draft before retrying.`,
    );
  if (saved.validationErrors || !Number.isInteger(saved.revision))
    throw new Error(saved.validationErrors || 'Unexpected save response. Inspect the model before retrying.');
  return saved;
}
