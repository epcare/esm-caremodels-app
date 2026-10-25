import React, { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  InlineNotification,
  NumberInput,
  Search,
  Select,
  SelectItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  TextArea,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { OpenmrsConceptSetDetails, OpenmrsSetMember } from '../../../api/caremodels.resource';
import { validSourceAlias } from './data-source-builder.component';
import styles from '../designer.scss';

/**
 * Shared member discovery table for grouped observation sets: lists the parent concept's actual
 * set members (in set order), with include/chart compatibility selection. Quantitative chart
 * selection is only enabled for numeric members; coded, text, date and boolean members remain
 * available in the history table. Cycles are impossible through REST: members arrive flattened.
 */
export function SetMembersTable({
  members,
  included,
  charted = [],
  onChange,
}: {
  members: Array<OpenmrsSetMember>;
  included: Array<string>;
  charted?: Array<string>;
  onChange: (included: Array<string>, charted: Array<string>) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => !needle || member.display.toLowerCase().includes(needle));
  }, [members, query]);
  const toggle = (uuid: string, list: Array<string>, next: boolean) =>
    next ? [...list, uuid] : list.filter((item) => item !== uuid);
  return (
    <Stack gap={3}>
      <Search
        size="sm"
        id="set-member-search"
        labelText={t('searchMembers', 'Search members')}
        placeholder={t('searchMembersPlaceholder', 'Filter by member name')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <TableContainer>
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>{t('memberConcept', 'Member concept')}</TableHeader>
              <TableHeader>{t('datatype', 'Datatype')}</TableHeader>
              <TableHeader>{t('conceptClass', 'Class')}</TableHeader>
              <TableHeader>{t('include', 'Include')}</TableHeader>
              <TableHeader>{t('showInChart', 'Show in chart')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((member) => {
              const numeric = (member.datatype?.display ?? '').toLowerCase() === 'numeric';
              const isIncluded = included.includes(member.uuid);
              return (
                <TableRow key={member.uuid}>
                  <TableCell>{member.display}</TableCell>
                  <TableCell>
                    <Tag size="sm" type={numeric ? 'blue' : 'gray'}>
                      {member.datatype?.display ?? t('unknown', 'Unknown')}
                    </Tag>
                  </TableCell>
                  <TableCell>{member.conceptClass?.display ?? '—'}</TableCell>
                  <TableCell>
                    <Checkbox
                      id={`include-${member.uuid}`}
                      hideLabel
                      labelText={t('include', 'Include')}
                      checked={isIncluded}
                      onChange={(_, { checked }) => onChange(toggle(member.uuid, included, checked), charted)}
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      id={`chart-${member.uuid}`}
                      hideLabel
                      labelText={t('showInChart', 'Show in chart')}
                      checked={charted.includes(member.uuid)}
                      disabled={!numeric || !isIncluded}
                      onChange={(_, { checked }) => onChange(included, toggle(member.uuid, charted, checked))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <p className={styles.sectionHint}>
        {t(
          'chartCompatibilityHint',
          'Only numeric members can be charted. Coded, text, date and boolean members remain available in the history table.',
        )}
      </p>
    </Stack>
  );
}

/** Parent concept panel: set metadata with actual membership as the qualification criterion. */
export function SetConceptSummary({ concept }: { concept: OpenmrsConceptSetDetails }) {
  const { t } = useTranslation();
  const isSet = concept.set === true || (concept.setMembers?.length ?? 0) > 0;
  const synonyms = (concept.names ?? [])
    .filter((name) => !name.voided && name.conceptNameType === 'SYNONYM')
    .map((name) => name.name);
  return (
    <dl className={styles.sourceDetailGrid}>
      <dt>{t('concept', 'Concept')}</dt>
      <dd>{concept.display}</dd>
      <dt>UUID</dt>
      <dd>{concept.uuid}</dd>
      <dt>{t('datatype', 'Datatype')}</dt>
      <dd>{concept.datatype?.display ?? '—'}</dd>
      <dt>{t('conceptClass', 'Concept class')}</dt>
      <dd>{concept.conceptClass?.display ?? '—'}</dd>
      <dt>{t('isSet', 'Is set')}</dt>
      <dd>{isSet ? t('yes', 'Yes') : t('no', 'No')}</dd>
      <dt>{t('memberCount', 'Set members')}</dt>
      <dd>{concept.setMembers?.length ?? 0}</dd>
      {synonyms.length > 0 && (
        <>
          <dt>{t('synonyms', 'Synonyms')}</dt>
          <dd>{synonyms.join(', ')}</dd>
        </>
      )}
    </dl>
  );
}

export const setSourceDefaults = {
  windowDays: 730,
  maxResults: 50,
};

export function isValidSetParent(concept?: OpenmrsConceptSetDetails | null): boolean {
  return Boolean(concept && (concept.set === true || (concept.setMembers?.length ?? 0) > 0));
}

/** Step indicator for the five-step grouped-set source editor. */
export function SetBuilderSteps({ current, labels }: { current: number; labels: Array<string> }) {
  return (
    <ol className={styles.setBuilderSteps}>
      {labels.map((label, index) => (
        <li key={label} className={index === current ? styles.setBuilderStepActive : undefined}>
          {index + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

export function RetrievalSettings({
  history,
  maxResults,
  windowDays,
  onChange,
}: {
  history: boolean;
  maxResults: number;
  windowDays: number;
  onChange: (next: { history?: boolean; maxResults?: number; windowDays?: number }) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap={4}>
      <Select
        id="set-retrieval-mode"
        labelText={t('retrievalMode', 'Retrieval mode')}
        value={history ? 'history' : 'latest'}
        onChange={(event) => {
          const nextHistory = event.target.value === 'history';
          onChange({ history: nextHistory, maxResults: nextHistory ? Math.max(2, maxResults) : 1 });
        }}>
        <SelectItem value="latest" text={t('latestGroup', 'Latest (newest parent group)')} />
        <SelectItem value="history" text={t('historyGroups', 'History (used by history widgets)')} />
      </Select>
      <p className={styles.sectionHint}>
        {t(
          'groupingStrategyHint',
          'Grouping strategy: parent observation group. Uses actual parent-child observation relationships; results are never combined across groups.',
        )}
      </p>
      {history && (
        <NumberInput
          id="set-max-groups"
          label={t('maxGroups', 'Maximum parent groups')}
          min={2}
          max={1000}
          value={maxResults}
          onChange={(_, { value }) => {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 2 && n <= 1000) onChange({ maxResults: n });
          }}
        />
      )}
      <NumberInput
        id="set-window-days"
        label={t('windowDays', 'Date window (days)')}
        min={1}
        max={3650}
        value={windowDays}
        onChange={(_, { value }) => {
          const n = Number(value);
          if (Number.isInteger(n) && n >= 1 && n <= 3650) onChange({ windowDays: n });
        }}
      />
    </Stack>
  );
}

/** Basic-information fields shared by create and edit flows. */
export function SetIdentityFields({
  keyName,
  label,
  description,
  keyInvalid,
  onChange,
}: {
  keyName?: string;
  label: string;
  description: string;
  keyInvalid?: boolean;
  onChange: (next: { key?: string; label?: string; description?: string }) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap={4}>
      {keyName !== undefined && (
        <TextInput
          id="set-source-key"
          labelText={t('dataSourceKey', 'Data source key')}
          value={keyName}
          invalid={Boolean(keyName) && keyInvalid}
          invalidText={t('uniqueSourceKey', 'Enter a unique key starting with a letter.')}
          onChange={(event) => onChange({ key: event.target.value })}
        />
      )}
      <TextInput
        id="set-source-label"
        labelText={t('displayName', 'Display name')}
        value={label}
        maxLength={100}
        onChange={(event) => onChange({ label: event.target.value })}
      />
      <TextArea
        id="set-source-description"
        labelText={t('description', 'Description')}
        value={description}
        maxLength={500}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <div>
        <p className={styles.inlineFieldLabel}>{t('sourceCategoryLabel', 'Source category')}</p>
        <Tag type="blue" size="sm">
          {t('groupedObservations', 'Grouped Observations (Lab/Concept Set)')}
        </Tag>
      </div>
    </Stack>
  );
}

export function isValidSourceKey(key: string, existingKeys: Array<string>): boolean {
  return validSourceAlias(key) && !existingKeys.includes(key);
}

export function ConceptSetHint({ concept }: { concept?: OpenmrsConceptSetDetails | null }) {
  const { t } = useTranslation();
  if (!concept) return null;
  if (isValidSetParent(concept))
    return (
      <InlineNotification
        kind="success"
        lowContrast
        hideCloseButton
        title={t('validSetConcept', 'Valid set concept: {{count}} members found.', {
          count: concept.setMembers?.length ?? 0,
        })}
        subtitle={t(
          'validSetConceptHint',
          'The parent concept datatype being N/A is allowed for observation sets; membership is the qualification criterion.',
        )}
      />
    );
  return (
    <InlineNotification
      kind="error"
      lowContrast
      hideCloseButton
      title={t(
        'notAValidSet',
        'This concept is not a valid set. Select a concept set with at least one member to use grouped observations.',
      )}
    />
  );
}

export function MoveUpDown({
  onUp,
  onDown,
  onRemove,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span>
      <Button kind="ghost" size="sm" onClick={onUp}>
        {t('moveUp', 'Up')}
      </Button>
      <Button kind="ghost" size="sm" onClick={onDown}>
        {t('moveDown', 'Down')}
      </Button>
      <Button kind="danger--ghost" size="sm" onClick={onRemove}>
        {t('remove', 'Remove')}
      </Button>
    </span>
  );
}
