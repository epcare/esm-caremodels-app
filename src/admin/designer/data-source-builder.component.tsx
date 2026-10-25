import { RecordSourceBuilder, RecordSourceSettings } from './record-source-builder.component';
import React, { useState } from 'react';
import useSWR from 'swr';
import {
  Button,
  FilterableMultiSelect,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Stack,
  Tag,
  TextInput,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import {
  fetchConceptDetails,
  fetchConceptSetDetails,
  type OpenmrsChoice,
  type OpenmrsConcept,
  type OpenmrsConceptSetDetails,
} from '../../api/caremodels.resource';
import type { DataSourceDefinition, ModelDefinition, WidgetInstance } from '../../types/caremodels';
import { ConceptSelector } from '../concept-selector.component';
import { manifestFor, sourceCompatibility } from '../../widgets/widget-registry';
import { SetSourceBuilder } from './data-source-set-builder.component';
import { RetrievalSettings, SetMembersTable, isValidSetParent } from './data-source-set-shared.component';
import styles from './designer.scss';

export const validSourceAlias = (value: string) => /^[a-z][a-zA-Z0-9._-]{0,99}$/.test(value);
export function conceptResultType(concept?: OpenmrsConcept): DataSourceDefinition['resultType'] | undefined {
  const type = (concept?.datatype?.name ?? concept?.datatype?.display ?? '').toLowerCase();
  const resultTypes: Record<string, DataSourceDefinition['resultType']> = {
    numeric: 'NUMBER',
    coded: 'CODED',
    text: 'STRING',
    date: 'DATE',
    datetime: 'DATE',
  };
  return resultTypes[type];
}
export function DataSourceBuilder({
  definition,
  onSave,
  widget,
}: {
  definition: ModelDefinition;
  onSave: (definition: ModelDefinition, key: string) => void;
  widget?: WidgetInstance;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('observation');
  const [groupedConcept, setGroupedConcept] = useState<OpenmrsConcept>();
  const [key, setKey] = useState('');
  const [pickerRevision, setPickerRevision] = useState(0);
  const [alias, setAlias] = useState('');
  const [concept, setConcept] = useState<OpenmrsConcept>();
  const [answers, setAnswers] = useState<Array<OpenmrsChoice>>([]);
  const [history, setHistory] = useState(
    widget?.type === 'trend-chart' || widget?.type === 'clinical-table' || widget?.type === 'timeline',
  );
  const [maxResults, setMaxResults] = useState(50);
  const [windowDays, setWindowDays] = useState(365);
  const resultType = conceptResultType(concept);
  // N/A or otherwise unsupported datatypes are never rejected outright: inspect set membership
  // first. A valid concept set belongs to the grouped observation flow, not this one.
  const inspectAsSet = Boolean(concept && !resultType);
  const { data: setDetails, error: setDetailsError } = useSWR<OpenmrsConceptSetDetails>(
    inspectAsSet ? ['caremodels-concept-set', concept!.uuid] : null,
    ([, uuid]: [string, string]) => fetchConceptSetDetails(uuid),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateIfStale: false, keepPreviousData: true },
  );
  const isValidSet = inspectAsSet && isValidSetParent(setDetails);
  const source: DataSourceDefinition = {
    type: 'latest-observation',
    conceptAlias: alias,
    resultType: resultType ?? 'STRING',
    maxResults: history ? maxResults : 1,
    windowDays,
    includeVoided: false,
    ...(concept?.units && concept.units.length <= 20 ? { units: concept.units } : {}),
  };
  const mismatch = widget && concept ? sourceCompatibility(widget, source) : null;
  const collision = Boolean(
    concept && definition.terminology.concepts?.[alias] && definition.terminology.concepts[alias] !== concept.uuid,
  );
  return (
    <Stack gap={4}>
      <Select
        id="source-category"
        labelText={t('sourceCategory', 'Source category')}
        value={category}
        onChange={(event) => setCategory(event.target.value)}>
        <SelectItem value="observation" text={t('observation', 'Observation')} />
        <SelectItem value="records" text={t('clinicalRecords', 'Clinical records')} />
        <SelectItem value="set" text={t('groupedObservations', 'Grouped Observations (Lab/Concept Set)')} />
      </Select>
      {category === 'records' ? (
        <RecordSourceBuilder definition={definition} onSave={onSave} widget={widget} />
      ) : category === 'set' ? (
        <SetSourceBuilder
          key={groupedConcept?.uuid ?? 'blank'}
          definition={definition}
          onSave={onSave}
          initialConcept={groupedConcept}
        />
      ) : (
        <>
          <p>
            {t(
              'observationResolverScope',
              'The registered observation resolver supports one concept per source. Use separate sources and widgets for separate concepts. Select Clinical records for other registered source families.',
            )}
          </p>
          <TextInput
            id="source-key"
            labelText={t('dataSourceKey', 'Data source key')}
            value={key}
            invalid={Boolean(key) && (!validSourceAlias(key) || key in definition.dataSources)}
            invalidText={t('uniqueSourceKey', 'Enter a unique key starting with a letter.')}
            onChange={(event) => {
              setKey(event.target.value);
              if (!alias || alias === `${key.slice(0, 70)}.concept`)
                setAlias(event.target.value ? `${event.target.value.slice(0, 70)}.concept` : '');
            }}
          />
          <TextInput
            id="source-alias"
            labelText={t('conceptAlias', 'Concept alias')}
            value={alias}
            invalid={Boolean(alias) && (!validSourceAlias(alias) || collision)}
            invalidText={t('conceptAliasCollision', 'Use a valid alias that does not replace another concept.')}
            onChange={(event) => setAlias(event.target.value)}
          />
          <ConceptSelector
            key={pickerRevision}
            onSelect={(next) => {
              setConcept(next);
              setAnswers([]);
            }}
          />
          {concept && (
            <>
              <dl>
                <dt>{t('concept', 'Concept')}</dt>
                <dd>{concept.display}</dd>
                <dt>UUID</dt>
                <dd>{concept.uuid}</dd>
                <dt>{t('datatype', 'Datatype')}</dt>
                <dd>{concept.datatype?.display ?? '—'}</dd>
                <dt>{t('conceptClass', 'Concept class')}</dt>
                <dd>{concept.conceptClass?.display ?? '—'}</dd>
                <dt>{t('units', 'Units')}</dt>
                <dd>{concept.units ?? '—'}</dd>
              </dl>
              {concept.mappings?.map((mapping, index) => (
                <p key={index}>
                  {mapping.display ??
                    [mapping.conceptReferenceTerm?.conceptSource?.display, mapping.conceptReferenceTerm?.code]
                      .filter(Boolean)
                      .join(': ')}
                </p>
              ))}
              {!resultType && isValidSet && (
                <InlineNotification
                  kind="success"
                  hideCloseButton
                  title={t('validSetConceptShort', 'Valid concept set: {{count}} members found.', {
                    count: setDetails?.setMembers?.length ?? 0,
                  })}
                  subtitle={t(
                    'validSetSwitchHint',
                    'The datatype is N/A, which is allowed for grouped observation sets. Single-value sources do not support this concept.',
                  )}
                />
              )}
              {!resultType && isValidSet && (
                <Button
                  kind="primary"
                  size="sm"
                  onClick={() => {
                    setGroupedConcept(concept);
                    setCategory('set');
                  }}>
                  {t('useGroupedSource', 'Use grouped source')}
                </Button>
              )}
              {!resultType && !isValidSet && (setDetails || setDetailsError) && (
                <InlineNotification
                  kind="warning"
                  hideCloseButton
                  title={t(
                    'unsupportedConceptDatatype',
                    'This concept datatype is not supported by the registered observation resolver and it is not a concept set.',
                  )}
                />
              )}
              {resultType === 'CODED' && (
                <FilterableMultiSelect<OpenmrsChoice>
                  id="concept-answers"
                  titleText={t('validCodedAnswers', 'Valid coded answers')}
                  placeholder={t('selectCodedAnswers', 'Select answers to bind for enrollment rules')}
                  items={concept.answers ?? []}
                  selectedItems={answers}
                  itemToString={(item) => item?.display ?? ''}
                  onChange={({ selectedItems }) => setAnswers(selectedItems ?? [])}
                  helperText={t(
                    'codedAnswerScope',
                    'Selected answer UUIDs are added to terminology.codedAnswers. This resolver does not support filtering observation results by an answer.',
                  )}
                />
              )}
            </>
          )}
          <div>
            <p className={styles.inlineFieldLabel}>{t('resultType', 'Result type')}</p>
            {resultType ? (
              <Tag type="blue" size="sm">
                {resultType}
              </Tag>
            ) : (
              <Tag type="gray" size="sm">
                {t('resultTypePending', 'Select a supported concept')}
              </Tag>
            )}
            <p className={styles.sectionHint}>
              {t(
                'resultTypeDerivedHint',
                'Derived from the concept datatype; the registered observation resolver does not allow overriding it.',
              )}
            </p>
          </div>
          <Select
            id="observation-strategy"
            labelText={t('selectionStrategy', 'Selection strategy')}
            value={history ? 'history' : 'latest'}
            onChange={(event) => setHistory(event.target.value === 'history')}>
            <SelectItem value="latest" text={t('latestValue', 'Latest value')} />
            <SelectItem value="history" text={t('recentObservations', 'Recent observations (bounded history)')} />
          </Select>
          {history && (
            <NumberInput
              id="source-max-results"
              label={t('maxResults', 'Maximum results')}
              min={2}
              max={1000}
              value={maxResults}
              onChange={(_, { value }) => {
                const n = Number(value);
                if (Number.isInteger(n) && n >= 2 && n <= 1000) setMaxResults(n);
              }}
            />
          )}
          <NumberInput
            id="source-window-days"
            label={t('windowDays', 'Window (days)')}
            min={1}
            max={3650}
            value={windowDays}
            onChange={(_, { value }) => {
              const n = Number(value);
              if (Number.isInteger(n) && n >= 1 && n <= 3650) setWindowDays(n);
            }}
          />
          {mismatch && (
            <InlineNotification
              kind="warning"
              hideCloseButton
              title={t('incompatibleSource', 'Incompatible data source')}
              subtitle={t(`sourceCompatibility.${mismatch}`, mismatch)}
            />
          )}
          <Button
            kind="tertiary"
            disabled={
              !concept ||
              !resultType ||
              !validSourceAlias(key) ||
              !validSourceAlias(alias) ||
              key in definition.dataSources ||
              collision ||
              Boolean(mismatch) ||
              Object.keys(definition.dataSources).length >= 200
            }
            onClick={() => {
              const codedAnswers = { ...definition.terminology.codedAnswers };
              for (const answer of answers) codedAnswers[`${alias.slice(0, 55)}.answer-${answer.uuid}`] = answer.uuid;
              onSave(
                {
                  ...definition,
                  terminology: {
                    ...definition.terminology,
                    concepts: { ...definition.terminology.concepts, [alias]: concept!.uuid },
                    ...(answers.length ? { codedAnswers } : {}),
                  },
                  dataSources: { ...definition.dataSources, [key]: source },
                },
                key,
              );
              setKey('');
              setAlias('');
              setConcept(undefined);
              setPickerRevision((value) => value + 1);
              setAnswers([]);
            }}>
            {t('createDataSource', 'Create data source')}
          </Button>
        </>
      )}
    </Stack>
  );
}

/** Shared editor for existing observation source declarations, including widget inspector usage.
 * Mirrors the create form's field set and order; only key and concept picker are absent. */
export function SourceSettings({
  sourceKey,
  definition,
  onChange,
}: {
  sourceKey: string;
  definition: ModelDefinition;
  onChange: (value: ModelDefinition) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const source = definition.dataSources[sourceKey];
  if (!source) return null;
  if (source.type === 'observation-set') return <ObservationSetSourceSettings sourceKey={sourceKey} definition={definition} onChange={onChange} />;
  if (
    ['program-state', 'encounter-query', 'order-query'].includes(source.type) ||
    (source.type === 'registered' &&
      ['conditions', 'encounter-diagnoses', 'patient-summary'].includes(source.resolverId ?? ''))
  )
    return <RecordSourceSettings sourceKey={sourceKey} definition={definition} onChange={onChange} />;
  if (!['latest-observation', 'historical-observations'].includes(source.type))
    return (
      <InlineNotification
        kind="warning"
        hideCloseButton
        title={t(
          'unsupportedSourcePreserved',
          'This source has no registered editor or resolver here. Its configuration is preserved.',
        )}
      />
    );
  return (
    <ObservationSourceSettings
      sourceKey={sourceKey}
      definition={definition}
      onChange={onChange}
      error={error}
      setError={setError}
    />
  );
}

function ObservationSourceSettings({
  sourceKey,
  definition,
  onChange,
  error,
  setError,
}: {
  sourceKey: string;
  definition: ModelDefinition;
  onChange: (value: ModelDefinition) => void;
  error: string | null;
  setError: (message: string | null) => void;
}) {  const { t } = useTranslation();
  const source = definition.dataSources[sourceKey];
  const conceptUuid = source.conceptAlias ? definition.terminology.concepts?.[source.conceptAlias] : undefined;
  const { data: concept } = useSWR(
    conceptUuid ? ['caremodels-concept-detail', conceptUuid] : null,
    ([, uuid]: [string, string]) => fetchConceptDetails(uuid),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateIfStale: false, keepPreviousData: true },
  );
  // Result type follows the concept datatype, exactly as at creation time.
  const derivedType = conceptResultType(concept);
  const history = source.type === 'historical-observations';
  const update = (patch: Partial<DataSourceDefinition>) => {
    const next = { ...source, ...patch };
    const boundWidgets = definition.workspace.tabs
      .flatMap((tab) => tab.widgets)
      .filter((widget) => widget.dataSource === sourceKey || widget.dataSources?.includes(sourceKey));
    const reason = boundWidgets.map((widget) => sourceCompatibility(widget, next)).find(Boolean);
    const unitConflict = boundWidgets.some((widget) =>
      widget.dataSources?.some((key) => key !== sourceKey && definition.dataSources[key]?.units !== next.units),
    );
    if (reason || unitConflict) {
      setError(reason ?? 'Chart series require matching explicit units.');
      return;
    }
    setError(null);
    onChange({
      ...definition,
      dataSources: { ...definition.dataSources, [sourceKey]: next },
      ...(patch.units !== undefined
        ? {
            workspace: {
              ...definition.workspace,
              tabs: definition.workspace.tabs.map((tab) => ({
                ...tab,
                widgets: tab.widgets.map((widget) =>
                  widget.dataSource === sourceKey
                    ? {
                        ...widget,
                        properties: sourceCompatibility(widget, next) === null &&
                          (manifestFor(widget)?.configurable.includes('unit') ?? false)
                          ? { ...widget.properties, unit: patch.units }
                          : Object.fromEntries(
                              Object.entries(widget.properties ?? {}).filter(([key]) => key !== 'unit'),
                            ),
                      }
                    : widget,
                ),
              })),
            },
          }
        : {}),
    });
  };
  return (
    <Stack gap={4}>
      {error && (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title={t('sourceEditRejected', 'Source change was not applied')}
          subtitle={t(`sourceCompatibility.${error}`, error)}
        />
      )}
      <Select
        id={`source-concept-${sourceKey}`}
        labelText={t('conceptAlias', 'Concept alias')}
        value={source.conceptAlias ?? ''}
        onChange={(event) => update({ conceptAlias: event.target.value })}>
        {Object.keys(definition.terminology.concepts ?? {}).map((alias) => (
          <SelectItem key={alias} value={alias} text={`${alias} — ${definition.terminology.concepts![alias]}`} />
        ))}
      </Select>
      <div>
        <p className={styles.inlineFieldLabel}>{t('resultType', 'Result type')}</p>
        <Tag type="blue" size="sm">
          {derivedType ?? source.resultType}
        </Tag>
        <p className={styles.sectionHint}>
          {t(
            'resultTypeDerivedHint',
            'Derived from the concept datatype; the registered observation resolver does not allow overriding it.',
          )}
        </p>
      </div>
      <Select
        id={`source-strategy-${sourceKey}`}
        labelText={t('selectionStrategy', 'Selection strategy')}
        value={history ? 'history' : 'latest'}
        onChange={(event) => {
          const nextHistory = event.target.value === 'history';
          update({
            type: nextHistory ? 'historical-observations' : 'latest-observation',
            maxResults: nextHistory ? Math.max(2, source.maxResults ?? 50) : 1,
          });
        }}>
        <SelectItem value="latest" text={t('latestValue', 'Latest value')} />
        <SelectItem value="history" text={t('recentObservations', 'Recent observations (bounded history)')} />
      </Select>
      {history && (
        <NumberInput
          id={`source-limit-${sourceKey}`}
          label={t('maxResults', 'Maximum results')}
          min={2}
          max={1000}
          value={source.maxResults ?? 50}
          onChange={(_, { value }) => {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 2 && n <= 1000) update({ maxResults: n });
          }}
        />
      )}
      <NumberInput
        id={`source-window-${sourceKey}`}
        label={t('windowDays', 'Window (days)')}
        min={1}
        max={3650}
        value={source.windowDays ?? 365}
        onChange={(_, { value }) => {
          const n = Number(value);
          if (Number.isInteger(n) && n >= 1 && n <= 3650) update({ windowDays: n });
        }}
      />
      <TextInput
        id={`source-units-${sourceKey}`}
        labelText={t('units', 'Units')}
        maxLength={20}
        value={source.units ?? ''}
        onChange={(event) => update({ units: event.target.value })}
      />
    </Stack>
  );
}

/** Editor for grouped observation-set declarations: identity, retrieval and member selection. */
function ObservationSetSourceSettings({
  sourceKey,
  definition,
  onChange,
}: {
  sourceKey: string;
  definition: ModelDefinition;
  onChange: (value: ModelDefinition) => void;
}) {
  const { t } = useTranslation();
  const source = definition.dataSources[sourceKey];
  const conceptUuid = source.conceptAlias ? definition.terminology.concepts?.[source.conceptAlias] : undefined;
  const { data: details } = useSWR(
    conceptUuid ? ['caremodels-concept-set', conceptUuid] : null,
    ([, uuid]: [string, string]) => fetchConceptSetDetails(uuid),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateIfStale: false, keepPreviousData: true },
  );
  const included = source.members ?? (details?.setMembers ?? []).map((member) => member.uuid);
  if (!source) return null;
  const update = (patch: Partial<DataSourceDefinition>) => {
    const next = { ...source, ...patch };
    const boundWidgets = definition.workspace.tabs
      .flatMap((tab) => tab.widgets)
      .filter((widget) => widget.dataSource === sourceKey || widget.dataSources?.includes(sourceKey));
    const reason = boundWidgets.map((widget) => sourceCompatibility(widget, next)).find(Boolean);
    if (reason) return; // never let a source edit silently break a bound widget
    onChange({ ...definition, dataSources: { ...definition.dataSources, [sourceKey]: next } });
  };
  return (
    <Stack gap={4}>
      <TextInput
        id={`set-source-label-${sourceKey}`}
        labelText={t('displayName', 'Display name')}
        maxLength={100}
        value={source.label ?? ''}
        onChange={(event) => update({ label: event.target.value || undefined })}
      />
      <TextInput
        id={`set-source-description-${sourceKey}`}
        labelText={t('description', 'Description')}
        maxLength={500}
        value={source.description ?? ''}
        onChange={(event) => update({ description: event.target.value || undefined })}
      />
      <RetrievalSettings
        history={(source.maxResults ?? 1) > 1}
        maxResults={source.maxResults ?? 50}
        windowDays={source.windowDays ?? 730}
        onChange={(next) =>
          update({
            ...(next.history !== undefined
              ? { maxResults: next.history ? Math.max(2, source.maxResults ?? 50) : 1 }
              : {}),
            ...(next.maxResults !== undefined ? { maxResults: next.maxResults } : {}),
            ...(next.windowDays !== undefined ? { windowDays: next.windowDays } : {}),
          })
        }
      />
      {details && isValidSetParent(details) ? (
        <>
          <p className={styles.inlineFieldLabel}>{t('membersSummary', 'Members (from the parent set)')}</p>
          <SetMembersTable
            members={details.setMembers ?? []}
            included={included}
            onChange={(nextIncluded) => update({ members: nextIncluded })}
          />
        </>
      ) : conceptUuid ? (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title={t('parentSetUnavailable', 'The parent concept is unavailable or is not a valid set.')}
        />
      ) : null}
    </Stack>
  );
}
