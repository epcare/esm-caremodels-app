import React, { useId } from 'react';
import { Button, NumberInput, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { RuleGroup, RuleNode, RulePredicate } from '../../types/caremodels';
import styles from './designer.scss';

export type { RuleGroup, RuleNode, RulePredicate } from '../../types/caremodels';
export function isGroup(node: RuleNode): node is RuleGroup {
  return 'all' in node || 'any' in node || 'not' in node;
}
export function emptyGroup(kind: 'all' | 'any'): RuleGroup {
  return { [kind]: [] };
}
export function emptyPredicate(): RulePredicate {
  return { type: 'observation', operator: 'EXISTS' };
}
const operators = [
  'EXISTS',
  'NOT_EXISTS',
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_THAN',
  'LESS_THAN',
  'GREATER_OR_EQUAL',
  'LESS_OR_EQUAL',
  'WITHIN_WINDOW',
  'OUTSIDE_WINDOW',
  'STATE_EQUALS',
];

/** Configuration only: the server validates semantics; no rules execute in the chart. */
export function RuleBuilder({
  node,
  onChange,
  onRemove,
  depth = 0,
}: {
  node: RuleNode;
  onChange: (next: RuleNode) => void;
  onRemove?: () => void;
  depth?: number;
}) {
  const { t } = useTranslation();
  const id = useId();
  if ('literal' in node)
    return (
      <Stack gap={3}>
        <Select
          id={`${id}-literal`}
          labelText={t('literal', 'Literal')}
          value={node.literal}
          onChange={(e) => onChange({ literal: e.target.value as 'TRUE' | 'FALSE' })}>
          <SelectItem value="TRUE" text="TRUE" />
          <SelectItem value="FALSE" text="FALSE" />
        </Select>
        <Button kind="ghost" onClick={() => onChange(emptyPredicate())}>
          {t('editCondition', 'Edit condition')}
        </Button>
        {onRemove && (
          <Button kind="danger--ghost" onClick={onRemove}>
            {t('removeCondition', 'Remove condition')}
          </Button>
        )}
      </Stack>
    );
  if (!isGroup(node))
    return (
      <div className={styles.predicateRow}>
        <Select
          id={`${id}-type`}
          labelText={t('predicateType', 'Predicate type')}
          value={node.type}
          onChange={(e) => onChange({ ...node, type: e.target.value as RulePredicate['type'] })}>
          {['program', 'encounter', 'observation', 'enrollment'].map((type) => (
            <SelectItem key={type} value={type} text={type} />
          ))}
        </Select>
        <TextInput
          id={`${id}-alias`}
          labelText={t('alias', 'Alias')}
          value={node.alias ?? ''}
          onChange={(e) => onChange({ ...node, alias: e.target.value || undefined })}
        />
        <Select
          id={`${id}-operator`}
          labelText={t('operator', 'Operator')}
          value={node.operator}
          onChange={(e) =>
            onChange({
              ...node,
              operator: e.target.value,
              ...(['WITHIN_WINDOW', 'OUTSIDE_WINDOW'].includes(e.target.value)
                ? { windowDays: node.windowDays ?? 30 }
                : {}),
            })
          }>
          {operators.map((op) => (
            <SelectItem key={op} value={op} text={op} />
          ))}
        </Select>
        <Select
          id={`${id}-value-type`}
          labelText={t('valueType', 'Value type')}
          value={typeof node.value}
          onChange={(e) =>
            onChange({
              ...node,
              value:
                e.target.value === 'number'
                  ? 0
                  : e.target.value === 'boolean'
                    ? false
                    : e.target.value === 'undefined'
                      ? undefined
                      : '',
            })
          }>
          <SelectItem value="undefined" text={t('noValue', 'No value')} />
          <SelectItem value="string" text={t('text', 'Text')} />
          <SelectItem value="number" text={t('number', 'Number')} />
          <SelectItem value="boolean" text={t('boolean', 'Boolean')} />
        </Select>
        {typeof node.value === 'boolean' ? (
          <Select
            id={`${id}-boolean`}
            labelText={t('value', 'Value')}
            value={String(node.value)}
            onChange={(e) => onChange({ ...node, value: e.target.value === 'true' })}>
            <SelectItem value="true" text="true" />
            <SelectItem value="false" text="false" />
          </Select>
        ) : (
          node.value !== undefined && (
            <TextInput
              id={`${id}-value`}
              labelText={t('value', 'Value')}
              type={typeof node.value === 'number' ? 'number' : 'text'}
              value={String(node.value)}
              onChange={(e) =>
                onChange({ ...node, value: typeof node.value === 'number' ? Number(e.target.value) : e.target.value })
              }
            />
          )
        )}
        {['WITHIN_WINDOW', 'OUTSIDE_WINDOW'].includes(node.operator) && (
          <NumberInput
            id={`${id}-window`}
            label={t('windowDays', 'Window (days)')}
            min={1}
            max={3650}
            value={node.windowDays ?? 30}
            onChange={(_, { value }) => onChange({ ...node, windowDays: Number(value) })}
          />
        )}
        <Button kind="ghost" size="sm" onClick={() => onChange({ not: node })}>
          {t('negate', 'Negate (NOT)')}
        </Button>
        {onRemove && (
          <Button kind="danger--ghost" size="sm" onClick={onRemove}>
            {t('removeCondition', 'Remove condition')}
          </Button>
        )}
      </div>
    );

  const kind = node.not ? 'not' : node.all ? 'all' : 'any';
  const children = node.not ? [node.not] : (node.all ?? node.any ?? []);
  const setChildren = (next: Array<RuleNode>) =>
    onChange(kind === 'not' ? { not: next[0] ?? emptyPredicate() } : { [kind]: next });
  return (
    <div className={depth ? styles.groupCardNested : styles.groupCard}>
      <div className={styles.groupHeader}>
        <Select
          id={`${id}-group`}
          labelText={t('groupOperator', 'Group operator')}
          value={kind}
          onChange={(e) =>
            onChange(
              e.target.value === 'not'
                ? { not: children.length === 1 ? children[0] : { all: children } }
                : { [e.target.value]: children },
            )
          }>
          <SelectItem value="all" text={t('allAnd', 'All (AND)')} />
          <SelectItem value="any" text={t('anyOr', 'Any (OR)')} />
          <SelectItem value="not" text={t('not', 'NOT')} />
        </Select>
        {kind !== 'not' && (
          <>
            <Button
              kind="tertiary"
              size="sm"
              disabled={children.length >= 50 || depth >= 10}
              onClick={() => setChildren([...children, emptyPredicate()])}>
              {t('addCondition', 'Add condition')}
            </Button>
            <Button
              kind="ghost"
              size="sm"
              disabled={children.length >= 50 || depth >= 10}
              onClick={() => setChildren([...children, emptyGroup('all')])}>
              {t('addGroup', 'Add group')}
            </Button>
          </>
        )}
        {onRemove && (
          <Button kind="danger--ghost" size="sm" onClick={onRemove}>
            {t('removeGroup', 'Remove group')}
          </Button>
        )}
      </div>
      {!children.length && (
        <p className={styles.groupEmpty}>{t('emptyRuleGroup', 'No conditions in this group yet.')}</p>
      )}
      {children.map((child, index) => (
        <RuleBuilder
          key={index}
          node={child}
          depth={depth + 1}
          onChange={(next) => setChildren(children.map((item, i) => (i === index ? next : item)))}
          onRemove={kind === 'not' ? undefined : () => setChildren(children.filter((_, i) => i !== index))}
        />
      ))}
    </div>
  );
}
