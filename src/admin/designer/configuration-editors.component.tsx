import React, { useState } from 'react';
import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Stack,
  TextInput,
  Tile,
  Tag,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { ActionDefinition, ModelDefinition, RuleNode } from '../../types/caremodels';
import type { OpenmrsForm } from '../../api/caremodels.resource';
import { FormMultiSelector, ResourceSelector } from '../resource-selector.component';
import { DataSourcesManager } from './data-sources-manager.component';
import { RuleBuilder, emptyGroup } from './rule-builder.component';
import styles from './designer.scss';

type EditorProps = { definition: ModelDefinition; onChange: (next: ModelDefinition) => void };
const validAlias = (value: string) => /^[a-z][a-zA-Z0-9._-]{0,99}$/.test(value);

export function DataSourcesEditor({ definition, onChange }: EditorProps) {
  const { t } = useTranslation();
  const [alias, setAlias] = useState('');
  const [bindingType, setBindingType] = useState<
    'concepts' | 'programs' | 'encounterTypes' | 'forms' | 'codedAnswers'
  >(
    'concepts',
  );
  return (
    <Stack gap={5}>
      <DataSourcesManager definition={definition} onChange={onChange} />
      <Accordion align="start">
        <AccordionItem title={t('terminologyBindings', 'Terminology bindings (advanced)')}>
          <Stack gap={5}>
            <h3>{t('terminologyBindings', 'OpenMRS resource bindings')}</h3>
            <Select
              id="binding-type"
              labelText={t('resourceType', 'Resource type')}
              value={bindingType}
              onChange={(e) => setBindingType(e.target.value as typeof bindingType)}>
              {['concepts', 'programs', 'encounterTypes', 'forms', 'codedAnswers'].map((key) => (
                <SelectItem key={key} value={key} text={key} />
              ))}
            </Select>
            <TextInput
              id="binding-alias"
              labelText={t('alias', 'Alias')}
              value={alias}
              invalid={Boolean(alias) && !validAlias(alias)}
              invalidText={t('aliasFormat', 'Use a letter followed by letters, digits, dots, underscores or hyphens.')}
              onChange={(e) => setAlias(e.target.value)}
            />
            <ResourceSelector
              key={bindingType}
              resource={
                bindingType === 'programs'
                  ? 'program'
                  : bindingType === 'encounterTypes'
                    ? 'encountertype'
                    : bindingType === 'forms'
                      ? 'form'
                      : 'concept'
              }
              label={t('findResource', 'Find an existing resource')}
              onSelect={(choice) => {
                if (!validAlias(alias)) return;
                onChange({
                  ...definition,
                  terminology: {
                    ...definition.terminology,
                    [bindingType]: { ...definition.terminology[bindingType], [alias]: choice.uuid },
                  },
                });
              }}
            />
            {Object.entries(definition.terminology).map(([type, aliases]) => (
              <Tile key={type}>
                <strong>{type}</strong>
                {Object.entries(aliases ?? {}).map(([key, uuid]) => {
                  // concept-like bindings must hold exact UUIDs; anything else fails validation
                  const invalidUuid =
                    (type === 'concepts' || type === 'codedAnswers') &&
                    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^[0-9a-fA-F]{32}$|^[0-9A-Za-z]{1,12}A{6,}$/.test(
                      String(uuid),
                    );
                  return (
                    <p key={key}>
                      {key}: {String(uuid)}
                      {invalidUuid && (
                        <Tag size="sm" type="red">
                          {t('invalidUuidBinding', 'Not a UUID — replace with the exact concept UUID')}
                        </Tag>
                      )}
                    </p>
                  );
                })}
              </Tile>
            ))}
            <p className={styles.sectionHint}>
              {t(
                'terminologyManagedBySourcesHint',
                'Creating or editing a data source keeps its resource alias and exact UUID in sync automatically. This section is for pre-declaring shared aliases.',
              )}
            </p>
          </Stack>
        </AccordionItem>
      </Accordion>
    </Stack>
  );
}

export function FormsEditor({ definition, onChange }: EditorProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Array<OpenmrsForm>>([]);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const pendingAliases = selected.map((form) => aliases[form.uuid] ?? '');
  const existingAliases = new Set([
    ...definition.forms.map((form) => form.alias),
    ...Object.keys(definition.terminology.forms ?? {}),
  ]);
  const invalidSelection =
    pendingAliases.some((alias) => !validAlias(alias) || existingAliases.has(alias)) ||
    new Set(pendingAliases).size !== pendingAliases.length;
  const selectForms = (forms: Array<OpenmrsForm>) => {
    const used = new Set(existingAliases);
    const next: Record<string, string> = {};
    for (const form of forms) {
      const base = form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      const candidate = /^[a-z]/.test(base) ? base : `form-${base || 'reference'}`;
      let alias = aliases[form.uuid] ?? candidate;
      let suffix = 2;
      if (!(form.uuid in aliases)) while (used.has(alias)) alias = `${candidate}-${suffix++}`;
      next[form.uuid] = alias;
      used.add(alias);
    }
    setAliases(next);
    setSelected(forms);
  };
  return (
    <Stack gap={5}>
      <InlineNotification
        kind="info"
        title={t(
          'formRuntimeLimit',
          'Form configuration is supported. Patient launching requires resolved form metadata from the workspace API.',
        )}
        hideCloseButton
      />
      <FormMultiSelector
        selected={selected}
        excludedUuids={definition.forms.map((form) => form.formUuid)}
        onChange={selectForms}
      />
      {selected.map((form) => (
        <TextInput
          key={form.uuid}
          id={`pending-alias-${form.uuid}`}
          labelText={t('aliasForForm', 'Alias for {{name}}', { name: form.name })}
          value={aliases[form.uuid] ?? ''}
          invalid={
            !validAlias(aliases[form.uuid] ?? '') ||
            existingAliases.has(aliases[form.uuid]) ||
            pendingAliases.filter((alias) => alias === aliases[form.uuid]).length > 1
          }
          invalidText={t('uniqueAlias', 'Enter a unique valid alias.')}
          onChange={(event) => setAliases({ ...aliases, [form.uuid]: event.target.value })}
        />
      ))}
      <Button
        kind="tertiary"
        disabled={!selected.length || invalidSelection || definition.forms.length + selected.length > 50}
        onClick={() => {
          const additions = selected.map((form) => ({ alias: aliases[form.uuid], formUuid: form.uuid }));
          onChange({
            ...definition,
            forms: [...definition.forms, ...additions],
            terminology: {
              ...definition.terminology,
              forms: {
                ...definition.terminology.forms,
                ...Object.fromEntries(additions.map((form) => [form.alias, form.formUuid])),
              },
            },
          });
          setSelected([]);
          setAliases({});
        }}>
        {t('addSelectedForms', 'Add selected forms')}
      </Button>
      <p>{t('associatedFormsCount', '{{count}} of 50 forms associated', { count: definition.forms.length })}</p>
      {definition.forms.map((form) => (
        <Tile key={form.alias}>
          <Stack gap={3}>
            <strong>{form.alias}</strong>
            <p>{form.formUuid}</p>
            <Checkbox
              id={`required-form-${form.alias}`}
              labelText={t('required', 'Required')}
              checked={form.required ?? false}
              onChange={(_, { checked }) =>
                onChange({
                  ...definition,
                  forms: definition.forms.map((item) =>
                    item.alias === form.alias ? { ...item, required: checked } : item,
                  ),
                })
              }
            />
            <Button
              kind="danger--ghost"
              disabled={
                definition.workspace.tabs.some((tab) =>
                  tab.widgets.some((widget) => widget.formAlias === form.alias),
                ) || definition.actions.some((action) => action.formAlias === form.alias)
              }
              onClick={() => {
                const forms = { ...definition.terminology.forms };
                delete forms[form.alias];
                onChange({
                  ...definition,
                  forms: definition.forms.filter((item) => item.alias !== form.alias),
                  terminology: { ...definition.terminology, forms },
                });
              }}>
              {t('removeForm', 'Remove form')}
            </Button>
          </Stack>
        </Tile>
      ))}
    </Stack>
  );
}

export function ActionsEditor({ definition, onChange }: EditorProps) {
  const { t } = useTranslation();
  const [id, setId] = useState('');
  const update = (next: ActionDefinition) =>
    onChange({ ...definition, actions: definition.actions.map((item) => (item.id === next.id ? next : item)) });
  return (
    <Stack gap={5}>
      <InlineNotification
        kind="info"
        title={t(
          'actionRuntimeLimit',
          'Actions reference approved handler types. Patient execution stays disabled until the authorized workspace exposes their metadata.',
        )}
        hideCloseButton
      />
      <div className={styles.tabToolbar}>
        <TextInput
          id="new-action-id"
          labelText={t('actionId', 'Action ID')}
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <Button
          kind="tertiary"
          disabled={
            !validAlias(id) || definition.actions.some((item) => item.id === id) || definition.actions.length >= 50
          }
          onClick={() => {
            onChange({
              ...definition,
              actions: [
                ...definition.actions,
                { id, label: id, type: 'launch-form', formAlias: definition.forms[0]?.alias },
              ],
            });
            setId('');
          }}>
          {t('addAction', 'Add action')}
        </Button>
      </div>
      {definition.actions.map((action) => (
        <Tile key={action.id}>
          <Stack gap={4}>
            <h4>{action.id}</h4>
            <TextInput
              id={`action-label-${action.id}`}
              labelText={t('label', 'Label')}
              value={action.label}
              onChange={(e) => update({ ...action, label: e.target.value })}
            />
            <Select
              id={`action-type-${action.id}`}
              labelText={t('handlerType', 'Handler type')}
              value={action.type}
              onChange={(e) =>
                update({
                  id: action.id,
                  label: action.label,
                  availabilityRule: action.availabilityRule,
                  type: e.target.value as ActionDefinition['type'],
                  ...(e.target.value === 'enrollment-transition'
                    ? { transition: 'COMPLETE' as const, requiresReason: true }
                    : {}),
                })
              }>
              {[
                'launch-form',
                'navigate-internal',
                'open-order-entry',
                'open-appointments',
                'enrollment-transition',
              ].map((type) => (
                <SelectItem key={type} value={type} text={type} />
              ))}
            </Select>
            {action.type === 'launch-form' ? (
              <Select
                id={`action-form-${action.id}`}
                labelText={t('formAlias', 'Form alias')}
                value={action.formAlias ?? ''}
                onChange={(e) => update({ ...action, formAlias: e.target.value })}>
                <SelectItem value="" text={t('selectForm', 'Select a form')} />
                {definition.forms.map((form) => (
                  <SelectItem key={form.alias} value={form.alias} text={form.alias} />
                ))}
              </Select>
            ) : action.type === 'enrollment-transition' ? (
              <>
                <Select
                  id={`action-transition-${action.id}`}
                  labelText={t('transition', 'Transition')}
                  value={action.transition ?? 'COMPLETE'}
                  onChange={(e) => update({ ...action, transition: e.target.value as ActionDefinition['transition'] })}>
                  {['SUSPEND', 'COMPLETE', 'WITHDRAW'].map((value) => (
                    <SelectItem key={value} value={value} text={value} />
                  ))}
                </Select>
                <p>
                  {t(
                    'transitionUnavailable',
                    'Membership transition endpoints are unavailable. This configuration cannot execute yet.',
                  )}
                </p>
              </>
            ) : (
              <TextInput
                id={`action-target-${action.id}`}
                labelText={t('internalTarget', 'Registered internal target')}
                value={action.target ?? ''}
                invalid={Boolean(action.target) && !/^[a-z][a-zA-Z0-9._/-]{0,199}$/.test(action.target!)}
                invalidText={t(
                  'invalidTarget',
                  'Use an internal target name; scripts and external URLs are not supported.',
                )}
                onChange={(e) => update({ ...action, target: e.target.value })}
              />
            )}
            <Button
              kind="danger--ghost"
              disabled={definition.workspace.tabs.some((tab) =>
                tab.widgets.some((widget) => widget.actionIds?.includes(action.id)),
              )}
              onClick={() =>
                onChange({ ...definition, actions: definition.actions.filter((item) => item.id !== action.id) })
              }>
              {t('removeAction', 'Remove action')}
            </Button>
          </Stack>
        </Tile>
      ))}
    </Stack>
  );
}

export function EnrollmentEditor({ definition, onChange }: EditorProps) {
  const { t } = useTranslation();
  const enrollment = definition.enrollment;
  const setEnrollment = (next: typeof enrollment) => onChange({ ...definition, enrollment: next });
  const triggerTypes = [
    'PROGRAM_CHANGED',
    'ENCOUNTER_SAVED',
    'ENCOUNTER_CHANGED',
    'ENCOUNTER_VOIDED',
    'OBSERVATION_SAVED',
    'OBSERVATION_CHANGED',
    'OBSERVATION_VOIDED',
  ];
  const referenceOptions = (type: string) => {
    if (type.startsWith('ENCOUNTER_'))
      return {
        field: 'encounterTypeAlias' as const,
        label: t('encounterTypeAlias', 'Encounter type alias'),
        values: definition.terminology.encounterTypes ?? {},
      };
    if (type.startsWith('PROGRAM_'))
      return {
        field: 'programAlias' as const,
        label: t('programAlias', 'Program alias'),
        values: definition.terminology.programs ?? {},
      };
    return {
      field: 'conceptAlias' as const,
      label: t('conceptAlias', 'Concept alias'),
      values: definition.terminology.concepts ?? {},
    };
  };
  const updateTrigger = (index: number, nextType: string, selectedAlias?: string, replaceReference = false) => {
    const options = referenceOptions(nextType);
    setEnrollment({
      ...enrollment,
      triggers: enrollment.triggers!.map((item, i) => {
        if (i !== index) return item;
        // Write one typed alias field. Generic legacy `alias` values are normalized when edited.
        const { alias: legacyAlias, conceptAlias, encounterTypeAlias, programAlias, ...rest } = item;
        const existingTyped = conceptAlias ?? encounterTypeAlias ?? programAlias;
        const legacyResolved = legacyAlias && options.values[legacyAlias]
          ? legacyAlias
          : Object.entries(options.values).find(([, uuid]) => uuid === legacyAlias)?.[0];
        const value = replaceReference
          ? selectedAlias
          : existingTyped && options.values[existingTyped]
            ? existingTyped
            : legacyResolved;
        return { ...rest, type: nextType, [options.field]: value || undefined };
      }),
    });
  };
  return (
    <Stack gap={5}>
      <InlineNotification
        kind="info"
        title={t(
          'ruleConfigurationOnly',
          'The backend evaluates published enrollment rules when a configured clinical trigger matches. A trigger without a matching enrollment rule does not enroll a patient.',
        )}
        hideCloseButton
      />
      <Checkbox
        id="enrollment-enabled"
        labelText={t('enableEnrollmentRules', 'Enable enrollment rules')}
        checked={enrollment.enabled}
        onChange={(_, { checked }) => setEnrollment({ ...enrollment, enabled: checked })}
      />
      <Checkbox
        id="manual-enabled"
        labelText={t('manualEnrollment', 'Allow manual enrollment (requires backend workflow)')}
        checked={enrollment.manualEnrollment?.enabled ?? false}
        onChange={(_, { checked }) =>
          setEnrollment({
            ...enrollment,
            manualEnrollment: { ...enrollment.manualEnrollment, enabled: checked, requiresReason: true },
          })
        }
      />
      <Checkbox
        id="reenrollment-enabled"
        labelText={t('reenrollment', 'Allow re-enrollment')}
        checked={enrollment.reenrollment?.enabled ?? false}
        onChange={(_, { checked }) =>
          setEnrollment({ ...enrollment, reenrollment: { ...enrollment.reenrollment, enabled: checked } })
        }
      />
      {enrollment.reenrollment?.enabled && (
        <NumberInput
          id="cooldown-days"
          label={t('cooldownDays', 'Re-enrollment cooldown (days)')}
          min={0}
          max={3650}
          value={enrollment.reenrollment.cooldownDays ?? 0}
          onChange={(_, { value }) =>
            setEnrollment({ ...enrollment, reenrollment: { ...enrollment.reenrollment, cooldownDays: Number(value) } })
          }
        />
      )}
      <h3>{t('clinicalTriggers', 'Clinical triggers')}</h3>
      {(enrollment.triggers ?? []).map((trigger, index) => (
        <div className={styles.tabToolbar} key={index}>
          <Select
            id={`trigger-${index}`}
            labelText={t('triggerType', 'Trigger type')}
            value={trigger.type}
            onChange={(e) => updateTrigger(index, e.target.value)}>
            {triggerTypes.map((type) => (
              <SelectItem key={type} value={type} text={type} />
            ))}
          </Select>
          {(() => {
            const options = referenceOptions(trigger.type);
            const direct = trigger[options.field];
            const legacy = trigger.alias;
            const legacyAlias = legacy && options.values[legacy]
              ? legacy
              : Object.entries(options.values).find(([, uuid]) => uuid === legacy)?.[0];
            const selected = direct && options.values[direct] ? direct : legacyAlias ?? '';
            return (
              <>
                <Select
                  id={`trigger-alias-${index}`}
                  labelText={options.label}
                  value={selected}
                  onChange={(e) => updateTrigger(index, trigger.type, e.target.value || undefined, true)}>
                  <SelectItem value="" text={t('anyMatchingResource', 'Any matching resource')} />
                  {Object.entries(options.values).map(([alias, uuid]) => (
                    <SelectItem key={alias} value={alias} text={`${alias} — ${uuid}`} />
                  ))}
                </Select>
                {trigger.alias && !direct && selected && options.values[selected] && (
                  <Button
                    kind="ghost"
                    size="sm"
                    onClick={() => updateTrigger(index, trigger.type, selected, true)}>
                    {t('repairTriggerAlias', 'Repair legacy trigger alias')}
                  </Button>
                )}
              </>
            );
          })()}
          <Button
            kind="danger--ghost"
            onClick={() =>
              setEnrollment({ ...enrollment, triggers: enrollment.triggers!.filter((_, i) => i !== index) })
            }>
            {t('removeTrigger', 'Remove trigger')}
          </Button>
        </div>
      ))}
      <Button
        kind="tertiary"
        disabled={(enrollment.triggers?.length ?? 0) >= 50}
        onClick={() =>
          setEnrollment({ ...enrollment, triggers: [...(enrollment.triggers ?? []), { type: 'OBSERVATION_SAVED' }] })
        }>
        {t('addTrigger', 'Add trigger')}
      </Button>
      {(enrollment.rules ?? []).map((rule, index) => (
        <Tile key={rule.id}>
          <Stack gap={4}>
            <TextInput
              id={`rule-id-${index}`}
              labelText={t('ruleId', 'Rule ID')}
              value={rule.id}
              onChange={(e) =>
                setEnrollment({
                  ...enrollment,
                  rules: enrollment.rules!.map((item, i) => (i === index ? { ...item, id: e.target.value } : item)),
                })
              }
            />
            <Select
              id={`rule-policy-${index}`}
              labelText={t('enrollmentPolicy', 'Enrollment policy')}
              value={rule.action}
              onChange={(e) =>
                setEnrollment({
                  ...enrollment,
                  rules: enrollment.rules!.map((item, i) =>
                    i === index ? { ...item, action: e.target.value as typeof rule.action } : item,
                  ),
                })
              }>
              <SelectItem value="PROPOSE_CONFIRMATION" text={t('confirmationPolicy', 'Require confirmation')} />
              <SelectItem value="AUTO_ENROLL" text={t('automaticPolicy', 'Automatic enrollment')} />
              <SelectItem value="EXCLUDE" text={t('exclusionPolicy', 'Exclude')} />
            </Select>
            <RuleBuilder
              node={rule.expression}
              onChange={(expression: RuleNode) =>
                setEnrollment({
                  ...enrollment,
                  rules: enrollment.rules!.map((item, i) => (i === index ? { ...item, expression } : item)),
                })
              }
            />
            <Button
              kind="danger--ghost"
              onClick={() => setEnrollment({ ...enrollment, rules: enrollment.rules!.filter((_, i) => i !== index) })}>
              {t('removeRule', 'Remove rule')}
            </Button>
          </Stack>
        </Tile>
      ))}
      <Button
        kind="tertiary"
        disabled={(enrollment.rules?.length ?? 0) >= 50}
        onClick={() =>
          setEnrollment({
            ...enrollment,
            rules: [
              ...(enrollment.rules ?? []),
              { id: `rule-${crypto.randomUUID()}`, action: 'PROPOSE_CONFIRMATION', expression: emptyGroup('all') },
            ],
          })
        }>
        {t('addRule', 'Add enrollment rule')}
      </Button>
    </Stack>
  );
}

export function PathwayEditor({ definition, onChange }: EditorProps) {
  const { t } = useTranslation();
  const pathway = definition.pathways ?? { enabled: false, stages: [], transitions: [] };
  const stages = pathway.stages ?? [];
  const transitions = pathway.transitions ?? [];
  const update = (next: typeof pathway) => onChange({ ...definition, pathways: next });
  return (
    <Stack gap={5}>
      <InlineNotification
        kind="info"
        title={t(
          'pathwayLimit',
          'Stages and transitions can be configured. This backend has no pathway runtime or activity schema.',
        )}
        hideCloseButton
      />
      <Checkbox
        id="pathway-enabled"
        labelText={t('enablePathway', 'Enable pathway configuration')}
        checked={pathway.enabled}
        onChange={(_, { checked }) => update({ ...pathway, enabled: checked })}
      />
      {stages.map((stage, index) => (
        <Tile key={stage.id}>
          <Stack gap={3}>
            <p>{stage.id}</p>
            <TextInput
              id={`stage-${stage.id}`}
              labelText={t('stageLabel', 'Stage label')}
              value={stage.label}
              onChange={(e) =>
                update({
                  ...pathway,
                  stages: stages.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)),
                })
              }
            />
            <Button
              kind="danger--ghost"
              disabled={transitions.some((item) => item.from === stage.id || item.to === stage.id)}
              onClick={() => update({ ...pathway, stages: stages.filter((_, i) => i !== index) })}>
              {t('removeStage', 'Remove stage')}
            </Button>
          </Stack>
        </Tile>
      ))}
      <Button
        kind="tertiary"
        disabled={stages.length >= 50}
        onClick={() =>
          update({
            ...pathway,
            stages: [...stages, { id: `stage-${crypto.randomUUID()}`, label: t('newStage', 'New stage') }],
          })
        }>
        {t('addStage', 'Add stage')}
      </Button>
      {transitions.map((transition, index) => (
        <Tile key={index}>
          <Stack gap={4}>
            {(['from', 'to'] as const).map((key) => (
              <Select
                key={key}
                id={`transition-${index}-${key}`}
                labelText={t(key, key)}
                value={transition[key]}
                onChange={(e) =>
                  update({
                    ...pathway,
                    transitions: transitions.map((item, i) =>
                      i === index ? { ...item, [key]: e.target.value } : item,
                    ),
                  })
                }>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id} text={stage.label} />
                ))}
              </Select>
            ))}
            {transition.expression && (
              <RuleBuilder
                node={transition.expression}
                onChange={(expression) =>
                  update({
                    ...pathway,
                    transitions: transitions.map((item, i) => (i === index ? { ...item, expression } : item)),
                  })
                }
              />
            )}
            {!transition.expression && (
              <Button
                kind="ghost"
                onClick={() =>
                  update({
                    ...pathway,
                    transitions: transitions.map((item, i) =>
                      i === index ? { ...item, expression: emptyGroup('all') } : item,
                    ),
                  })
                }>
                {t('addTransitionRule', 'Add transition condition')}
              </Button>
            )}
            <Button
              kind="danger--ghost"
              onClick={() => update({ ...pathway, transitions: transitions.filter((_, i) => i !== index) })}>
              {t('removeTransition', 'Remove transition')}
            </Button>
          </Stack>
        </Tile>
      ))}
      <Button
        kind="tertiary"
        disabled={stages.length < 2 || transitions.length >= 100}
        onClick={() => update({ ...pathway, transitions: [...transitions, { from: stages[0].id, to: stages[1].id }] })}>
        {t('addTransition', 'Add transition')}
      </Button>
    </Stack>
  );
}
