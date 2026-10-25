import React, { useState } from 'react';
import {
  Button,
  Checkbox,
  ComboBox,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from '@carbon/react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { searchOpenmrsResources, type OpenmrsChoice } from '../../../api/caremodels.resource';
import type { DataSourceDefinition, ModelDefinition, WidgetInstance } from '../../../types/caremodels';
import { ConceptSelector } from '../../concept-selector.component';
import { sourceCompatibility } from '../../../widgets/widget-registry';

export function RecordSourceBuilder({
  definition,
  onSave,
  widget,
}: {
  definition: ModelDefinition;
  onSave: (definition: ModelDefinition, key: string) => void;
  widget?: WidgetInstance;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState('conditions');
  const [key, setKey] = useState('');
  const [query, setQuery] = useState('');
  const [resource, setResource] = useState<OpenmrsChoice>();
  const [fields, setFields] = useState<NonNullable<DataSourceDefinition['fields']>>(['name', 'gender']);
  const [limit, setLimit] = useState(50);
  const [days, setDays] = useState(365);
  const family = kind === 'program-state' ? 'program' : kind === 'encounter-query' ? 'encountertype' : null;
  const { data, error } = useSWR(
    family && query.trim().length >= 2 ? ['caremodels-source-resource', family, query] : null,
    ([, r, q]) => searchOpenmrsResources(r as 'program' | 'encountertype', q),
    { shouldRetryOnError: false },
  );
  const alias = `${key.slice(0, 70)}.reference`;
  const referenceKind =
    kind === 'program-state'
      ? 'programs'
      : kind === 'encounter-query'
        ? 'encounterTypes'
        : kind === 'order-query'
          ? 'concepts'
          : null;
  const registered = ['conditions', 'encounter-diagnoses', 'patient-summary'].includes(kind);
  const source: DataSourceDefinition = {
    type: registered ? 'registered' : (kind as DataSourceDefinition['type']),
    resultType: 'TABLE',
    includeVoided: false,
    ...(registered ? { resolverId: kind, resolverVersion: '1.0.0' } : {}),
    ...(kind === 'patient-summary' ? { fields } : { maxResults: limit, windowDays: days }),
    ...(referenceKind
      ? {
          [kind === 'program-state'
            ? 'programAlias'
            : kind === 'encounter-query'
              ? 'encounterTypeAlias'
              : 'conceptAlias']: alias,
        }
      : {}),
  };
  const mismatch = widget ? sourceCompatibility(widget, source) : null;
  const collision =
    referenceKind &&
    definition.terminology[referenceKind]?.[alias] &&
    definition.terminology[referenceKind]?.[alias] !== resource?.uuid;
  return (
    <Stack gap={4}>
      <Select
        id="record-source-kind"
        labelText={t('recordSourceType', 'Clinical record source')}
        value={kind}
        onChange={(event) => {
          setKind(event.target.value);
          setResource(undefined);
          setQuery('');
        }}>
        {[
          'conditions',
          'encounter-diagnoses',
          'encounter-query',
          'program-state',
          'order-query',
          'patient-summary',
        ].map((value) => (
          <SelectItem key={value} value={value} text={t(`resolver.${value}`, value)} />
        ))}
      </Select>
      <TextInput
        id="record-source-key"
        labelText={t('dataSourceKey', 'Data source key')}
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      {family && (
        <ComboBox<OpenmrsChoice>
          key={kind}
          id="record-resource"
          titleText={t('searchResource', 'Search OpenMRS resources')}
          items={data ?? []}
          itemToString={(item) => (item ? `${item.display} · ${item.uuid}` : '')}
          onInputChange={setQuery}
          onChange={({ selectedItem }) => setResource(selectedItem ?? undefined)}
        />
      )}
      {kind === 'order-query' && (
        <>
          <ConceptSelector onSelect={setResource} />
          <p>
            {t('orderHistoryLimitation', 'Displays concept-scoped order history, not an inferred current regimen.')}
          </p>
        </>
      )}
      {error && (
        <InlineNotification kind="error" hideCloseButton title={t('resourceSearchFailed', 'Resource search failed')} />
      )}
      {kind === 'patient-summary' ? (
        (
          ['name', 'gender', 'birthdate', 'birthdateEstimated', 'dead', 'deathDate'] as NonNullable<
            DataSourceDefinition['fields']
          >
        ).map((field) => (
          <Checkbox
            key={field}
            id={`patient-field-${field}`}
            labelText={t(`patientField.${field}`, field)}
            checked={fields.includes(field)}
            onChange={(_, { checked }) =>
              setFields(checked ? [...fields, field] : fields.filter((item) => item !== field))
            }
          />
        ))
      ) : (
        <>
          <NumberInput
            id="record-source-limit"
            label={t('maxResults', 'Maximum results')}
            min={1}
            max={1000}
            value={limit}
            onChange={(_, { value }) => setLimit(Number(value))}
          />
          <NumberInput
            id="record-source-window"
            label={t('windowDays', 'Window (days)')}
            min={1}
            max={3650}
            value={days}
            onChange={(_, { value }) => setDays(Number(value))}
          />
        </>
      )}
      {mismatch && (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title={t('incompatibleSource', 'Incompatible data source')}
          subtitle={mismatch}
        />
      )}
      <Button
        kind="tertiary"
        disabled={
          !/^[a-z][a-zA-Z0-9._-]{0,99}$/.test(key) ||
          key in definition.dataSources ||
          Object.keys(definition.dataSources).length >= 200 ||
          Boolean(referenceKind && !resource) ||
          Boolean(collision) ||
          (kind === 'patient-summary' && !fields.length) ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 1000 ||
          !Number.isInteger(days) ||
          days < 1 ||
          days > 3650 ||
          Boolean(mismatch)
        }
        onClick={() => {
          onSave(
            {
              ...definition,
              terminology: referenceKind
                ? {
                    ...definition.terminology,
                    [referenceKind]: { ...definition.terminology[referenceKind], [alias]: resource!.uuid },
                  }
                : definition.terminology,
              dataSources: { ...definition.dataSources, [key]: source },
            },
            key,
          );
          setKey('');
        }}>
        {t('createDataSource', 'Create data source')}
      </Button>
    </Stack>
  );
}

export function RecordSourceSettings({
  sourceKey,
  definition,
  onChange,
}: {
  sourceKey: string;
  definition: ModelDefinition;
  onChange: (definition: ModelDefinition) => void;
}) {
  const { t } = useTranslation();
  const source = definition.dataSources[sourceKey];
  const update = (patch: Partial<DataSourceDefinition>) =>
    onChange({ ...definition, dataSources: { ...definition.dataSources, [sourceKey]: { ...source, ...patch } } });
  const key = source.programAlias
    ? 'programAlias'
    : source.encounterTypeAlias
      ? 'encounterTypeAlias'
      : source.conceptAlias
        ? 'conceptAlias'
        : null;
  const group = key === 'programAlias' ? 'programs' : key === 'encounterTypeAlias' ? 'encounterTypes' : 'concepts';
  return (
    <Stack gap={4}>
      <p>{t(`resolver.${source.resolverId ?? source.type}`, source.resolverId ?? source.type)}</p>
      {key && (
        <Select
          id={`record-reference-${sourceKey}`}
          labelText={t('resourceAlias', 'Resource alias')}
          value={String(source[key])}
          onChange={(event) => update({ [key]: event.target.value })}>
          {Object.entries(definition.terminology[group] ?? {}).map(([alias, uuid]) => (
            <SelectItem key={alias} value={alias} text={`${alias} · ${uuid}`} />
          ))}
        </Select>
      )}
      {source.resolverId === 'patient-summary' ? (
        (
          ['name', 'gender', 'birthdate', 'birthdateEstimated', 'dead', 'deathDate'] as NonNullable<
            DataSourceDefinition['fields']
          >
        ).map((field) => (
          <Checkbox
            key={field}
            id={`edit-${sourceKey}-${field}`}
            labelText={t(`patientField.${field}`, field)}
            checked={source.fields?.includes(field) ?? false}
            disabled={source.fields?.length === 1 && source.fields.includes(field)}
            onChange={(_, { checked }) =>
              update({
                fields: checked ? [...(source.fields ?? []), field] : source.fields?.filter((item) => item !== field),
              })
            }
          />
        ))
      ) : (
        <>
          <NumberInput
            id={`limit-${sourceKey}`}
            label={t('maxResults', 'Maximum results')}
            min={1}
            max={1000}
            value={source.maxResults ?? 100}
            onChange={(_, { value }) => {
              const n = Number(value);
              if (Number.isInteger(n) && n >= 1 && n <= 1000) update({ maxResults: n });
            }}
          />
          <NumberInput
            id={`window-${sourceKey}`}
            label={t('windowDays', 'Window (days)')}
            min={1}
            max={3650}
            value={source.windowDays ?? 365}
            onChange={(_, { value }) => {
              const n = Number(value);
              if (Number.isInteger(n) && n >= 1 && n <= 3650) update({ windowDays: n });
            }}
          />
        </>
      )}
    </Stack>
  );
}
