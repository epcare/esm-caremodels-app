import React, { useEffect, useState } from 'react';
import { Button, InlineNotification, Stack, Tag } from '@carbon/react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { fetchConceptSetDetails, type OpenmrsConcept } from '../../../api/caremodels.resource';
import type { DataSourceDefinition, ModelDefinition } from '../../../types/caremodels';
import { ConceptSelector } from '../../concept-selector.component';
import { setSourcePreviewFixture } from '../../../widgets/widget-registry';
import { validSourceAlias } from './data-source-builder.component';
import {
  ConceptSetHint,
  RetrievalSettings,
  SetBuilderSteps,
  SetConceptSummary,
  SetIdentityFields,
  SetMembersTable,
  isValidSetParent,
  isValidSourceKey,
  setSourceDefaults,
} from './data-source-set-shared.component';
import styles from '../designer.scss';

const steps = ['identity', 'concept', 'members', 'retrieval', 'validation'] as const;

/**
 * Five-step creation flow for Grouped Observations (Lab/Concept Set) sources: basic information,
 * parent concept (set membership is the qualification criterion), member discovery, retrieval
 * configuration, then validation with a synthetic preview. Produces an `observation-set` source.
 */
export function SetSourceBuilder({
  definition,
  onSave,
  initialConcept,
  initialStep = 0,
}: {
  definition: ModelDefinition;
  onSave: (definition: ModelDefinition, key: string) => void;
  /** Concept carried over from the ordinary builder when an N/A selection proves to be a set. */
  initialConcept?: OpenmrsConcept;
  initialStep?: number;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(initialStep);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [concept, setConcept] = useState<OpenmrsConcept | undefined>(initialConcept);
  const [included, setIncluded] = useState<Array<string>>([]);
  const [charted, setCharted] = useState<Array<string>>([]);
  const [history, setHistory] = useState(true);
  const [maxResults, setMaxResults] = useState(setSourceDefaults.maxResults);
  const [windowDays, setWindowDays] = useState(setSourceDefaults.windowDays);

  const { data: details } = useSWR(
    concept ? ['caremodels-concept-set', concept.uuid] : null,
    ([, uuid]: [string, string]) => fetchConceptSetDetails(uuid),
    // terminology metadata is static within a designer session; never re-block edits on it
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateIfStale: false, keepPreviousData: true },
  );
  useEffect(() => {
    if (isValidSetParent(details)) setIncluded((details?.setMembers ?? []).map((member) => member.uuid));
  }, [details]);

  const keyValid = isValidSourceKey(key, Object.keys(definition.dataSources));
  const parentValid = isValidSetParent(details);
  const membersValid = included.length > 0;
  const retrievalValid = history ? maxResults >= 2 && maxResults <= 1000 : true;
  const alias = key ? `${key.slice(0, 70)}.set` : '';
  const aliasCollision = Boolean(alias && definition.terminology.concepts?.[alias]);

  const source: DataSourceDefinition = {
    type: 'observation-set',
    conceptAlias: alias,
    resultType: 'TABLE',
    windowDays,
    maxResults: history ? maxResults : 1,
    includeVoided: false,
    members: included,
    ...(label ? { label } : {}),
    ...(description ? { description } : {}),
  };

  const keyProblem = !key
    ? t('checkKeyEmpty', 'Enter a data source key')
    : !validSourceAlias(key)
      ? t(
          'checkKeyFormat',
          'Key must start with a lowercase letter and use only letters, digits, dots, dashes or underscores (no spaces)',
        )
      : !isValidSourceKey(key, Object.keys(definition.dataSources))
        ? t('checkKeyTaken', 'Another data source in this model already uses the key "{{key}}"', { key })
        : null;
  const checks: Array<{ ok: boolean; text: string }> = [
    {
      ok: keyValid,
      text: keyProblem
        ? keyProblem
        : t('checkUniqueKey', 'Source key is unique and valid'),
    },
    { ok: parentValid, text: t('checkParentSet', 'Parent concept is a valid set with members') },
    {
      ok: membersValid,
      text: t('checkMembers', '{{count}} member(s) selected, all from the parent set', { count: included.length }),
    },
    { ok: retrievalValid, text: t('checkRetrieval', 'Retrieval settings are bounded (server-side limits enforced)') },
    { ok: true, text: t('checkResultShape', 'Result shape: typed parent groups (TABLE)') },
  ];
  const allValid = checks.every((check) => check.ok) && !aliasCollision;

  return (
    <Stack gap={4}>
      <SetBuilderSteps
        current={step}
        labels={[
          t('stepBasicInfo', 'Basic information'),
          t('stepParentConcept', 'Parent concept'),
          t('stepMembers', 'Members'),
          t('stepRetrieval', 'Retrieval'),
          t('stepValidation', 'Validation'),
        ]}
      />
      {step === 0 && (
        <>
          <SetIdentityFields
            keyName={key}
            keyInvalid={!keyValid}
            label={label}
            description={description}
            onChange={(next) => {
              if (next.key !== undefined) setKey(next.key);
              if (next.label !== undefined) setLabel(next.label);
              if (next.description !== undefined) setDescription(next.description);
            }}
          />
          <p className={styles.sectionHint}>
            {t('conceptAliasDerived', 'Concept alias "{{alias}}" will be declared in terminology.concepts.', { alias })}
          </p>
          {aliasCollision && (
            <InlineNotification
              kind="warning"
              hideCloseButton
              title={t('conceptAliasCollision', 'Use a valid alias that does not replace another concept.')}
            />
          )}
        </>
      )}
      {step === 1 && (
        <>
          <ConceptSelector onSelect={setConcept} />
          {concept && details && (
            <>
              <SetConceptSummary concept={details} />
              <ConceptSetHint concept={details} />
            </>
          )}
        </>
      )}
      {step === 2 && (
        <>
          {parentValid ? (
            <SetMembersTable
              members={details?.setMembers ?? []}
              included={included}
              charted={charted}
              onChange={(nextIncluded, nextCharted) => {
                setIncluded(nextIncluded);
                setCharted(nextCharted.filter((uuid) => nextIncluded.includes(uuid)));
              }}
            />
          ) : (
            <InlineNotification
              kind="warning"
              hideCloseButton
              title={t('selectValidSetFirst', 'Select a valid parent set concept before choosing members.')}
            />
          )}
        </>
      )}
      {step === 3 && (
        <RetrievalSettings
          history={history}
          maxResults={maxResults}
          windowDays={windowDays}
          onChange={(next) => {
            if (next.history !== undefined) setHistory(next.history);
            if (next.maxResults !== undefined) setMaxResults(next.maxResults);
            if (next.windowDays !== undefined) setWindowDays(next.windowDays);
          }}
        />
      )}
      {step === 4 && (
        <>
          <Stack gap={2}>
            {checks.map((check) => (
              <p key={check.text}>
                <Tag type={check.ok ? 'green' : 'red'} size="sm">
                  {check.ok ? '✓' : '✕'}
                </Tag>{' '}
                {check.text}
              </p>
            ))}
          </Stack>
          <div>
            <p className={styles.inlineFieldLabel}>
              {t('previewResults', 'Preview (synthetic fixture — no patient query is executed)')}
            </p>
            <SetPreviewFixture />
          </div>
        </>
      )}
      <div className={styles.sourcesToolbar}>
        <Button kind="ghost" size="sm" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
          {t('back', 'Back')}
        </Button>
        {step < steps.length - 1 ? (
          <Button
            kind="primary"
            size="sm"
            disabled={(step === 0 && !keyValid) || (step === 1 && !parentValid) || (step === 3 && !retrievalValid)}
            onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>
            {t('next', 'Next')}
          </Button>
        ) : (
          <Button
            kind="primary"
            size="sm"
            disabled={!allValid || Object.keys(definition.dataSources).length >= 200}
            onClick={() => {
              onSave(
                {
                  ...definition,
                  terminology: {
                    ...definition.terminology,
                    concepts: { ...definition.terminology.concepts, [alias]: concept!.uuid },
                  },
                  dataSources: { ...definition.dataSources, [key]: source },
                },
                key,
              );
              setKey('');
              setLabel('');
              setDescription('');
              setConcept(undefined);
              setIncluded([]);
              setCharted([]);
              setStep(0);
            }}>
            {t('saveDataSource', 'Save data source')}
          </Button>
        )}
      </div>
    </Stack>
  );
}

/** Synthetic preview of the grouped result shape; identical to the designer widget fixture. */
function SetPreviewFixture() {
  const { t } = useTranslation();
  const group = setSourcePreviewFixture.groups?.[0];
  if (!group) return null;
  return (
    <table className={styles.setPreviewTable}>
      <thead>
        <tr>
          <th>{t('memberHeader', 'Test / Member')}</th>
          <th>{t('result', 'Result')}</th>
          <th>{t('unit', 'Unit')}</th>
          <th>{t('datatype', 'Datatype')}</th>
        </tr>
      </thead>
      <tbody>
        {group.members.map((member) => (
          <tr key={member.obsUuid}>
            <td>{member.conceptDisplay}</td>
            <td>
              {member.value == null
                ? t('missingResult', 'Not recorded')
                : typeof member.value === 'object'
                  ? member.value.display
                  : String(member.value)}
            </td>
            <td>{member.unit ?? ''}</td>
            <td>
              <Tag size="sm" type="gray">
                {member.datatype}
              </Tag>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
