function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
const sameJson = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
/** Merge a reviewed workspace definition into an existing model, without changing enrollment policy. */
export function mergeWorkspaceUpdate(base, update, { verifiedForms = [] } = {}) {
  if (!base || !update || base.schemaVersion !== '1.0.0' || update.schemaVersion !== base.schemaVersion)
    throw new Error('A compatible clinical definition is required; do not import a storage envelope here.');
  const next = structuredClone(base);
  const incoming = structuredClone(update);
  const aliases = new Map();
  next.forms = structuredClone(base.forms ?? []);
  next.terminology = { ...base.terminology, forms: { ...base.terminology?.forms } };
  for (const form of incoming.forms ?? []) {
    const existing = (base.forms ?? []).find((candidate) => candidate.formUuid === form.formUuid);
    if (!existing) {
      if (incoming.terminology?.forms?.[form.alias] !== form.formUuid)
        throw new Error(`Incoming form alias ${form.alias} has inconsistent UUID references.`);
      if (
        next.forms.some((candidate) => candidate.alias === form.alias) ||
        (next.terminology.forms[form.alias] && next.terminology.forms[form.alias] !== form.formUuid)
      )
        throw new Error(`Form alias collision: ${form.alias}. Existing associations are preserved.`);
      const resource = verifiedForms.find((candidate) => candidate.uuid === form.formUuid);
      if (!resource || resource.retired !== false || resource.published !== true)
        throw new Error(
          `Form ${form.alias} (${form.formUuid}) must be verified as published and active in the OpenMRS form catalog before it can be associated with this model.`,
        );
      const expectedType = incoming.terminology?.encounterTypes?.[form.encounterTypeAlias];
      if (form.encounterTypeAlias && (!expectedType || resource.encounterType?.uuid !== expectedType))
        throw new Error(`Form encounter-type mismatch: ${form.alias}`);
      next.forms.push(form);
      next.terminology.forms[form.alias] = form.formUuid;
      aliases.set(form.alias, form.alias);
      continue;
    }
    if (base.terminology?.forms?.[existing.alias] !== existing.formUuid)
      throw new Error(`Existing form alias ${existing.alias} has inconsistent UUID references.`);
    aliases.set(form.alias, existing.alias);
  }
  const mapAlias = (alias) => {
    if (!aliases.has(alias)) throw new Error(`Undeclared incoming form alias: ${alias}`);
    return aliases.get(alias);
  };
  next.metadata = { ...next.metadata, ...incoming.metadata };
  next.terminology = { ...next.terminology };
  for (const [group, entries] of Object.entries(incoming.terminology ?? {})) {
    if (group === 'forms') continue;
    const merged = { ...next.terminology[group] };
    for (const [alias, uuid] of Object.entries(entries)) {
      if (!/^[a-z][a-zA-Z0-9._-]{0,99}$/.test(alias)) throw new Error(`Invalid terminology alias: ${alias}`);
      if (merged[alias] && merged[alias] !== uuid) throw new Error(`Terminology alias collision: ${group}.${alias}`);
      merged[alias] = uuid;
    }
    next.terminology[group] = merged;
  }
  next.actions = structuredClone(base.actions ?? []);
  for (const action of incoming.actions ?? []) {
    const mapped = { ...action, ...(action.formAlias ? { formAlias: mapAlias(action.formAlias) } : {}) };
    const existing = next.actions.find((candidate) => candidate.id === action.id);
    if (existing && !sameJson(existing, mapped)) throw new Error(`Action ID collision: ${action.id}`);
    if (!existing) next.actions.push(mapped);
  }
  next.dataSources = { ...next.dataSources };
  for (const [key, source] of Object.entries(incoming.dataSources ?? {})) {
    if (next.dataSources[key] && !sameJson(next.dataSources[key], source))
      throw new Error(
        `Data source collision: ${key}. Review or rename this source rather than silently overwriting it.`,
      );
    next.dataSources[key] = source;
  }
  next.workspace = incoming.workspace;
  for (const tab of next.workspace.tabs)
    for (const widget of tab.widgets) {
      if (widget.formAlias) widget.formAlias = mapAlias(widget.formAlias);
      if (widget.formAliases) widget.formAliases = widget.formAliases.map(mapAlias);
    }
  // No inferred patient pathway state; preserve authored stages for review but keep execution disabled.
  next.pathways = { ...base.pathways, enabled: false };
  return next;
}
