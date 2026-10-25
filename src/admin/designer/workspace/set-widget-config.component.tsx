import React, { useEffect } from 'react';
import {
  Checkbox,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Stack,
} from '@carbon/react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import type { ModelDefinition, WidgetInstance } from '../../../types/caremodels';
import { fetchConceptSetDetails } from '../../../api/caremodels.resource';
import { configuredMembers } from '../../../widgets/observation-set-format';
import { MoveUpDown } from '../builders/data-source-set-shared.component';
import styles from '../designer.scss';

/**
 * Member display selection for grouped-set widgets: rows come from the source's declared
 * members (set order); table inclusion, numeric-only chart inclusion and order are widget
 * properties. A configured member that is no longer declared by the source raises a validation
 * issue instead of being silently replaced.
 */
export function SetWidgetMembers({
  widget,
  definition,
  onWidgetChange,
}: {
  widget: WidgetInstance;
  definition: ModelDefinition;
  onWidgetChange: (widget: WidgetInstance) => void;
}) {
  const { t } = useTranslation();
  const source = definition.dataSources[widget.dataSource ?? ''];
  const conceptUuid = source?.conceptAlias ? definition.terminology.concepts?.[source.conceptAlias] : undefined;
  const { data: details } = useSWR(
    conceptUuid ? ['caremodels-concept-set', conceptUuid] : null,
    ([, uuid]: [string, string]) => fetchConceptSetDetails(uuid),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateIfStale: false, keepPreviousData: true },
  );
  const setMembers = details?.setMembers ?? [];
  const configs = configuredMembers(widget.properties);
  useEffect(() => {
    if (!details || configs.length || !setMembers.length) return;
    const declared = source?.members?.length ? source.members : setMembers.map((member) => member.uuid);
    onWidgetChange({
      ...widget,
      properties: {
        ...widget.properties,
        members: declared
          .filter((uuid) => setMembers.some((member) => member.uuid === uuid))
          .map((uuid) => {
            const member = setMembers.find((item) => item.uuid === uuid)!;
            return {
              conceptUuid: uuid,
              label: member.display,
              inTable: true,
              inChart: (member.datatype?.display ?? '').toLowerCase() === 'numeric',
            };
          }),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);
  const property = (key: string, value: unknown) =>
    onWidgetChange({ ...widget, properties: { ...widget.properties, [key]: value } });
  const updateConfigs = (next: Array<{ conceptUuid: string; label: string; inTable: boolean; inChart?: boolean }>) =>
    property('members', next.length ? next : undefined);
  const isNumeric = (uuid: string) =>
    (setMembers.find((member) => member.uuid === uuid)?.datatype?.display ?? '').toLowerCase() === 'numeric';
  const unknown = configs.filter((config) => setMembers.length && !setMembers.some((member) => member.uuid === config.conceptUuid));
  const unconfigured = setMembers.filter((member) => !configs.some((config) => config.conceptUuid === member.uuid));
  return (
    <Stack gap={4}>
      <p className={styles.inlineFieldLabel}>{t('membersToDisplay', 'Members to display')}</p>
      {unknown.length > 0 && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={t(
            'staleMemberSelection',
            '{{count}} configured member(s) are no longer declared by the data source. Remove them to resolve this issue.',
            { count: unknown.length },
          )}
        />
      )}
      <ul className={styles.memberConfigList}>
        {configs.map((config, index) => (
          <li key={config.conceptUuid}>
            <span className={unknown.some((stale) => stale.conceptUuid === config.conceptUuid) ? styles.staleMember : undefined}>
              {config.label}
            </span>
            <Checkbox
              id={`table-${config.conceptUuid}`}
              labelText={t('inTable', 'Table')}
              checked={config.inTable}
              onChange={(_, { checked }) =>
                updateConfigs(configs.map((item, i) => (i === index ? { ...item, inTable: checked } : item)))
              }
            />
            <Checkbox
              id={`chart-${config.conceptUuid}`}
              labelText={t('inChart', 'Chart')}
              checked={config.inChart === true}
              disabled={!isNumeric(config.conceptUuid) && config.inChart !== true}
              title={isNumeric(config.conceptUuid) ? undefined : t('numericOnly', 'Only numeric members can be charted')}
              onChange={(_, { checked }) =>
                updateConfigs(configs.map((item, i) => (i === index ? { ...item, inChart: checked } : item)))
              }
            />
            <MoveUpDown
              onUp={() =>
                index > 0 &&
                updateConfigs([...configs.slice(0, index - 1), configs[index], configs[index - 1], ...configs.slice(index + 1)])
              }
              onDown={() =>
                index < configs.length - 1 &&
                updateConfigs([...configs.slice(0, index), configs[index + 1], configs[index], ...configs.slice(index + 2)])
              }
              onRemove={() => updateConfigs(configs.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      {unconfigured.length > 0 && (
        <Select
          id="add-set-member"
          labelText={t('addMember', 'Add member')}
          value=""
          onChange={(event) => {
            const uuid = event.target.value;
            const member = setMembers.find((item) => item.uuid === uuid);
            if (member)
              updateConfigs([
                ...configs,
                {
                  conceptUuid: uuid,
                  label: member.display,
                  inTable: true,
                  inChart: (member.datatype?.display ?? '').toLowerCase() === 'numeric',
                },
              ]);
          }}>
          <SelectItem value="" text={t('selectMemberToAdd', 'Select a member to add')} />
          {unconfigured.map((member) => (
            <SelectItem key={member.uuid} value={member.uuid} text={member.display} />
          ))}
        </Select>
      )}
    </Stack>
  );
}

/** Display properties for the two grouped-set widgets. */
export function SetWidgetDisplay({
  widget,
  onWidgetChange,
}: {
  widget: WidgetInstance;
  onWidgetChange: (widget: WidgetInstance) => void;
}) {
  const { t } = useTranslation();
  const history = widget.type === 'set-history-trends';
  const property = (key: string, value: unknown) =>
    onWidgetChange({ ...widget, properties: { ...widget.properties, [key]: value } });
  const toggle = (key: string, label: string, checked: boolean) => (
    <Checkbox
      key={key}
      id={`set-${key}`}
      labelText={label}
      checked={checked}
      onChange={(_, { checked: next }) => property(key, next)}
    />
  );
  return (
    <Stack gap={4}>
      {history && (
        <Select
          id="set-default-view"
          labelText={t('defaultView', 'Default view')}
          value={String(widget.properties?.defaultView ?? 'chart')}
          onChange={(event) => property('defaultView', event.target.value)}>
          <SelectItem value="chart" text={t('chart', 'Chart')} />
          <SelectItem value="table" text={t('table', 'Table')} />
        </Select>
      )}
      {history && (
        <Select
          id="set-default-range"
          labelText={t('defaultRange', 'Default date range')}
          value={String(widget.properties?.defaultRange ?? '2y')}
          onChange={(event) => property('defaultRange', event.target.value)}>
          <SelectItem value="6m" text={t('range6m', 'Last 6 months')} />
          <SelectItem value="1y" text={t('range1y', 'Last year')} />
          <SelectItem value="2y" text={t('range2y', 'Last 2 years')} />
          <SelectItem value="5y" text={t('range5y', 'Last 5 years')} />
          <SelectItem value="all" text={t('rangeAll', 'All recorded')} />
        </Select>
      )}
      {history && (
        <Select
          id="set-chart-layout"
          labelText={t('chartLayout', 'Numeric chart series')}
          value={String(widget.properties?.chartLayout ?? 'panels')}
          onChange={(event) => property('chartLayout', event.target.value)}>
          <SelectItem value="panels" text={t('layoutPanels', 'Separate panels per unit')} />
          <SelectItem value="combined" text={t('layoutCombined', 'Combined (matching units only)')} />
        </Select>
      )}
      {history && (
        <NumberInput
          id="set-rows-per-page"
          label={t('rowsPerPage', 'Rows per page')}
          min={5}
          max={50}
          value={Number(widget.properties?.rowsPerPage ?? 5)}
          onChange={(_, { value }) => {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 5 && n <= 50) property('rowsPerPage', n);
          }}
        />
      )}
      {widget.type === 'latest-set-results' && (
        <Select
          id="set-density"
          labelText={t('displayDensity', 'Display density')}
          value={String(widget.properties?.density ?? 'compact')}
          onChange={(event) => property('density', event.target.value)}>
          <SelectItem value="compact" text={t('compact', 'Compact')} />
          <SelectItem value="regular" text={t('regular', 'Regular')} />
        </Select>
      )}
      {widget.type === 'latest-set-results' && (
        <NumberInput
          id="set-max-visible"
          label={t('maxVisibleMembers', 'Maximum visible members')}
          min={1}
          max={50}
          value={Number(widget.properties?.maxVisible ?? 12)}
          onChange={(_, { value }) => {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 1 && n <= 50) property('maxVisible', n);
          }}
        />
      )}
      {toggle('showDate', t('showObservationDate', 'Show observation date'), widget.properties?.showDate !== false)}
      {toggle('showUnits', t('showUnits', 'Show units'), widget.properties?.showUnits !== false)}
      {toggle(
        'showReferenceRange',
        t('showReferenceRanges', 'Show reference ranges when available'),
        widget.properties?.showReferenceRange === true,
      )}
      {toggle('showMissing', t('showMissingMembers', 'Show missing members'), widget.properties?.showMissing !== false)}
    </Stack>
  );
}
