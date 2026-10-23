import React, { useMemo, useState } from 'react';
import {
  Button,
  ContentSwitcher,
  DataTable,
  InlineNotification,
  Modal,
  Pagination,
  Search,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add, Edit } from '@carbon/react/icons';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { fetchOpenmrsResource } from '../../api/caremodels.resource';
import type { DataSourceDefinition, ModelDefinition, RuleNode, RulePredicate } from '../../types/caremodels';
import { DataSourceBuilder, SourceSettings } from './data-source-builder.component';
import styles from './designer.scss';

type TerminologyBucket = 'concepts' | 'programs' | 'encounterTypes' | 'forms';
type SourceCategory = TerminologyBucket | 'other';

/** The terminology bucket and alias a source references, per the canonical contract. */
export function sourceResource(source: DataSourceDefinition): { bucket: TerminologyBucket; alias: string } | null {
  if (source.programAlias) return { bucket: 'programs', alias: source.programAlias };
  if (source.encounterTypeAlias) return { bucket: 'encounterTypes', alias: source.encounterTypeAlias };
  if (source.conceptAlias) return { bucket: 'concepts', alias: source.conceptAlias };
  if (source.formAlias) return { bucket: 'forms', alias: source.formAlias };
  return null;
}

export function sourceCategory(source: DataSourceDefinition): SourceCategory {
  return sourceResource(source)?.bucket ?? 'other';
}

export function sourceTypeLabel(source: DataSourceDefinition, t: (key: string, fallback: string) => string): string {
  switch (source.type) {
    case 'latest-observation':
      return t('sourceType.latestObservation', 'Concept (latest observation)');
    case 'historical-observations':
      return t('sourceType.historicalObservations', 'Concept (bounded history)');
    case 'encounter-query':
      return t('sourceType.encounterQuery', 'Encounter query');
    case 'program-state':
      return t('sourceType.programState', 'Program state');
    case 'order-query':
      return t('sourceType.orderQuery', 'Order history');
    case 'registered':
      return t('sourceType.registered', `Registered: ${source.resolverId ?? 'resolver'}`);
  }
}

/** Widgets bound to the source key. These are true dependencies and block deletion. */
export function findWidgetUsage(definition: ModelDefinition, sourceKey: string): Array<SourceUsage> {
  const usage: Array<SourceUsage> = [];
  for (const tab of definition.workspace.tabs)
    for (const widget of tab.widgets)
      if (widget.dataSource === sourceKey || widget.dataSources?.includes(sourceKey))
        usage.push({
          kind: 'widget',
          id: widget.id,
          name: String(widget.properties?.title ?? widget.id),
          location: `Workspace → ${tab.label}`,
        });
  return usage;
}

export interface SourceUsage {
  kind: 'widget' | 'rule';
  id: string;
  name: string;
  location: string;
}

function collectRuleAliases(node: RuleNode | undefined, visit: (predicate: RulePredicate) => void) {
  if (!node || typeof node !== 'object') return;
  if ('all' in node) node.all?.forEach((child) => collectRuleAliases(child, visit));
  if ('any' in node) node.any?.forEach((child) => collectRuleAliases(child, visit));
  if ('not' in node) collectRuleAliases(node.not, visit);
  if ('type' in node) visit(node);
}

/**
 * Rule predicates that reference the source's resource alias. They reference the shared
 * terminology alias, not the source key, so they inform but do not block deletion.
 */
export function findAliasReferences(definition: ModelDefinition, alias: string): Array<SourceUsage> {
  const references: Array<SourceUsage> = [];
  const visit = (node: RulePredicate, location: string, name: string) => {
    if (node.alias === alias) references.push({ kind: 'rule', id: node.type, name, location });
  };
  const walk = (expression: RuleNode | undefined, location: string, name: string) =>
    collectRuleAliases(expression, (predicate) => visit(predicate, location, name));
  definition.enrollment.rules?.forEach((rule) => walk(rule.expression, 'Enrollment Rules', rule.id));
  definition.automation?.rules?.forEach((rule) => walk(rule.expression, 'Automation', rule.id));
  definition.pathways?.transitions?.forEach((transition, index) =>
    walk(transition.expression, 'Care Pathway', `${transition.from} → ${transition.to} (${index})`),
  );
  definition.enrollment.triggers?.forEach((trigger, index) => {
    if (trigger.alias === alias)
      references.push({ kind: 'rule', id: `trigger-${index}`, name: trigger.type, location: 'Enrollment Rules' });
  });
  return references;
}

const restResource: Record<TerminologyBucket, 'concept' | 'program' | 'encountertype' | 'form'> = {
  concepts: 'concept',
  programs: 'program',
  encounterTypes: 'encountertype',
  forms: 'form',
};

/**
 * Master–detail manager over the canonical draft: a searchable, filterable registry of the
 * definition's declared sources plus an inspector that edits them without mutating anything
 * until Save. Creation reuses the guided DataSourceBuilder; editing reuses SourceSettings.
 */
export function DataSourcesManager({
  definition,
  onChange,
}: {
  definition: ModelDefinition;
  onChange: (next: ModelDefinition) => void;
}) {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<'details' | 'edit' | 'create'>('details');
  const [filter, setFilter] = useState<'all' | SourceCategory>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<ModelDefinition | null>(null);

  const entries = useMemo(() => Object.entries(definition.dataSources), [definition.dataSources]);
  const categories = useMemo(() => {
    const counts: Record<'all' | SourceCategory, number> = {
      all: entries.length,
      concepts: 0,
      programs: 0,
      encounterTypes: 0,
      forms: 0,
      other: 0,
    };
    for (const [, source] of entries) counts[sourceCategory(source)] += 1;
    return counts;
  }, [entries]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter(([, source]) => filter === 'all' || sourceCategory(source) === filter)
      .filter(([key, source]) => {
        if (!needle) return true;
        const resource = sourceResource(source);
        const uuid = resource ? definition.terminology[resource.bucket]?.[resource.alias] : undefined;
        return [key, resource?.alias, uuid].some((value) => value?.toLowerCase().includes(needle));
      })
      .map(([key, source]) => {
        const resource = sourceResource(source);
        return {
          id: key,
          key,
          type: sourceTypeLabel(source, t),
          category: sourceCategory(source),
          alias: resource?.alias ?? '—',
          uuid: (resource ? definition.terminology[resource.bucket]?.[resource.alias] : undefined) ?? '—',
          usage: findWidgetUsage(definition, key).length,
        };
      });
  }, [entries, filter, query, definition, t]);

  const selectedSource = selectedKey ? definition.dataSources[selectedKey] : undefined;
  const showInspector = mode !== 'create' && Boolean(selectedSource);
  const selectedResource = selectedSource ? sourceResource(selectedSource) : null;
  const resolvedUuid = selectedResource
    ? definition.terminology[selectedResource.bucket]?.[selectedResource.alias]
    : undefined;
  const { data: resolved } = useSWR(
    resolvedUuid ? ['caremodels-resource-display', selectedResource!.bucket, resolvedUuid] : null,
    ([, bucket, uuid]) => fetchOpenmrsResource(restResource[bucket as TerminologyBucket], uuid),
    { shouldRetryOnError: false },
  );
  const widgetUsage = selectedKey ? findWidgetUsage(definition, selectedKey) : [];
  const aliasReferences =
    selectedSource && selectedResource ? findAliasReferences(definition, selectedResource.alias) : [];

  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));

  const headers = [
    { key: 'key', header: t('name', 'Name') },
    { key: 'type', header: t('type', 'Type') },
    { key: 'alias', header: t('clinicalItem', 'Clinical item') },
    { key: 'usage', header: t('usedIn', 'Used in') },
  ];

  return (
    <div>
      <Stack gap={4}>
        <InlineNotification
          kind="info"
          hideCloseButton
          title={t('sourcesFromDefinition', 'These sources are declared by this model definition.')}
          subtitle={t(
            'sourcesFromDefinitionHint',
            'They are saved into dataSources with exact resource UUIDs in terminology. Widgets, rules and actions reference them by key or alias.',
          )}
        />
        <div className={showInspector ? styles.sourcesManager : undefined}>
          <section aria-label={t('dataSourceRegistry', 'Data source registry')}>
            <div className={styles.sourcesToolbar}>
              <ContentSwitcher
                size="sm"
                selectedIndex={
                  filter === 'all' ? 0 : ({ concepts: 1, encounterTypes: 2, forms: 3, programs: 4, other: 5 } as const)[filter]
                }
                onChange={({ name }) => {
                  setFilter(name as typeof filter);
                  setPage(1);
                }}>
                <Switch name="all" text={t('allSources', 'All ({{count}})', { count: categories.all })} />
                <Switch name="concepts" text={t('conceptSources', 'Concepts ({{count}})', { count: categories.concepts })} />
                <Switch
                  name="encounterTypes"
                  text={t('encounterTypeSources', 'Encounter types ({{count}})', { count: categories.encounterTypes })}
                />
                <Switch name="forms" text={t('formSources', 'Forms ({{count}})', { count: categories.forms })} />
                <Switch name="programs" text={t('programSources', 'Programs ({{count}})', { count: categories.programs })} />
                <Switch name="other" text={t('otherSources', 'Other ({{count}})', { count: categories.other })} />
              </ContentSwitcher>
              <Search
                size="sm"
                id="source-search"
                labelText={t('searchDataSources', 'Search data sources')}
                placeholder={t('searchDataSourcesPlaceholder', 'Search by key, alias or UUID')}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
              <Button
                kind="primary"
                size="sm"
                renderIcon={Add}
                onClick={() => {
                  setMode('create');
                  setDraft(null);
                }}>
                {t('createDataSource', 'Create data source')}
              </Button>
            </div>
            <DataTable size="sm" rows={pageRows} headers={headers} aria-label={t('dataSourceRegistry', 'Data source registry')}>
              {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {tableHeaders.map((header) => (
                          <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tableRows.map((row) => {
                        const rowData = pageRows.find((item) => item.id === row.id);
                        const select = () => {
                          setSelectedKey(row.id);
                          setMode('details');
                        };
                        return (
                        <TableRow {...getRowProps({ row })} isSelected={selectedKey === row.id} onClick={select}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'type' ? (
                                <Tag type={rowData?.category === 'other' ? 'gray' : 'blue'} size="sm">
                                  {cell.value}
                                </Tag>
                              ) : cell.info.header === 'usage' ? (
                                <Tag type={cell.value > 0 ? 'green' : 'gray'} size="sm">
                                  {cell.value > 0
                                    ? t('usedByWidgets', '{{count}} widgets', { count: cell.value })
                                    : t('unusedSource', 'Unused')}
                                </Tag>
                              ) : cell.info.header === 'alias' ? (
                                <>
                                  {String(cell.value)}
                                  <span className={styles.sourceUuidCell}>
                                    {rowData?.uuid && rowData.uuid !== '—'
                                      ? rowData.uuid.length > 18
                                        ? `${rowData.uuid.slice(0, 18)}…`
                                        : rowData.uuid
                                      : ''}
                                  </span>
                                </>
                              ) : cell.info.header === 'key' ? (
                                <button type="button" className={styles.sourceKeyButton} onClick={select}>
                                  {cell.value}
                                </button>
                              ) : (
                                cell.value
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
            {!rows.length && (
              <p className={styles.sourcesEmpty}>
                {entries.length
                  ? t('noMatchingSources', 'No data sources match the current search or filter.')
                  : t('noDataSourcesDefined', 'No data sources are defined yet. Create one to bind widgets to clinical data.')}
              </p>
            )}
            {rows.length > 0 && (
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                pageSizes={[10, 20, 50]}
                totalItems={rows.length}
                onChange={({ page: nextPage, pageSize: nextSize }) => {
                  setPage(nextPage);
                  setPageSize(nextSize);
                }}
              />
            )}
          </section>
          {showInspector && (
          <aside className={styles.sourcesInspector} aria-label={t('sourceInspector', 'Data source inspector')}>
            {selectedSource && selectedKey && (
              mode === 'edit' && draft ? (
                <Stack gap={4}>
                  <h4>{t('editDataSource', 'Edit {{key}}', { key: selectedKey })}</h4>
                  <SourceSettings sourceKey={selectedKey} definition={draft} onChange={setDraft} />
                  <div className={styles.sourcesToolbar}>
                    <Button
                      kind="primary"
                      size="sm"
                      disabled={JSON.stringify(draft.dataSources[selectedKey]) === JSON.stringify(selectedSource)}
                      onClick={() => {
                        onChange(draft);
                        setDraft(null);
                        setMode('details');
                      }}>
                      {t('saveChanges', 'Save changes')}
                    </Button>
                    <Button
                      kind="ghost"
                      size="sm"
                      onClick={() => {
                        setDraft(null);
                        setMode('details');
                      }}>
                      {t('cancel', 'Cancel')}
                    </Button>
                  </div>
                </Stack>
              ) : (
                <SourceDetails
                  sourceKey={selectedKey}
                  source={selectedSource}
                  alias={selectedResource?.alias}
                  resolvedUuid={resolvedUuid}
                  resolvedDisplay={resolved?.display}
                  widgetUsage={widgetUsage}
                  aliasReferences={aliasReferences}
                  onEdit={() => {
                    setDraft(definition);
                    setMode('edit');
                  }}
                  onDelete={() => setConfirmDelete(true)}
                />
              )
            )}
          </aside>
          )}
        </div>
      </Stack>
      <Modal
        open={mode === 'create'}
        passiveModal
        size="lg"
        modalHeading={t('createDataSource', 'Create data source')}
        modalLabel={t('dataSources', 'Clinical data sources')}
        onRequestClose={() => setMode('details')}>
        <Stack gap={4}>
          <p className={styles.sectionHint}>
            {t(
              'createSourceHint',
              'Pick a registered resolver, enter a unique key, select an exact OpenMRS resource and configure retrieval. The source is saved into this draft only.',
            )}
          </p>
          <DataSourceBuilder
            definition={definition}
            onSave={(next, key) => {
              onChange(next);
              setSelectedKey(key);
              setMode('details');
            }}
          />
          <Button kind="ghost" onClick={() => setMode('details')}>
            {t('cancel', 'Cancel')}
          </Button>
        </Stack>
      </Modal>
      <Modal
        open={confirmDelete}
        danger
        modalHeading={t('deleteSourceHeading', 'Delete data source {{key}}?', { key: selectedKey })}
        modalLabel={t('dataSources', 'Clinical data sources')}
        primaryButtonText={t('deleteSource', 'Delete data source')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestClose={() => setConfirmDelete(false)}
        onRequestSubmit={() => {
          if (!selectedKey || widgetUsage.length) return;
          const next = { ...definition.dataSources };
          delete next[selectedKey];
          onChange({ ...definition, dataSources: next });
          setConfirmDelete(false);
          setSelectedKey(null);
          setMode('details');
        }}>
        <p>
          {widgetUsage.length
            ? t('deleteSourceBlocked', 'This source is referenced by {{count}} widgets. Remove those bindings first.', {
                count: widgetUsage.length,
              })
            : t(
                'deleteSourceWarning',
                'This removes the source from the draft. Widget bindings that reference it would break, so deletion is blocked while any widget uses it.',
              )}
        </p>
      </Modal>
    </div>
  );
}

function SourceDetails({
  sourceKey,
  source,
  alias,
  resolvedUuid,
  resolvedDisplay,
  widgetUsage,
  aliasReferences,
  onEdit,
  onDelete,
}: {
  sourceKey: string;
  source: DataSourceDefinition;
  alias?: string;
  resolvedUuid?: string;
  resolvedDisplay?: string;
  widgetUsage: Array<SourceUsage>;
  aliasReferences: Array<SourceUsage>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const strategy =
    source.type === 'historical-observations'
      ? t('strategyHistory', 'Recent observations (bounded history)')
      : source.type === 'latest-observation'
        ? t('strategyLatest', 'Latest value')
        : t('strategyResolver', 'Registered resolver semantics');
  const details: Array<[string, React.ReactNode]> = [
    [t('sourceKeyLabel', 'Source key'), sourceKey],
    [t('sourceTypeLabel', 'Source type'), sourceTypeLabel(source, t)],
    [t('resourceAlias', 'Resource alias'), alias ?? '—'],
    [
      t('resolvedResource', 'Resolved resource'),
      resolvedUuid ? (
        <>
          {resolvedDisplay ?? t('resolvingDisplay', 'Resolving…')}
          <span className={styles.sourceUuidCell}>{resolvedUuid}</span>
        </>
      ) : (
        '—'
      ),
    ],
    [t('resultType', 'Result type'), source.resultType],
    [t('selectionStrategy', 'Selection strategy'), strategy],
    [t('maxResults', 'Maximum results'), String(source.maxResults ?? 1)],
    [t('windowDays', 'Time window'), source.windowDays ? t('windowDaysValue', '{{count}} days', { count: source.windowDays }) : '—'],
    [t('includeVoided', 'Include voided'), source.includeVoided ? t('yes', 'Yes') : t('no', 'No')],
  ];
  if (source.units) details.push([t('units', 'Units'), source.units]);
  if (source.resolverId) details.push([t('resolverId', 'Resolver'), `${source.resolverId} (${source.resolverVersion ?? '—'})`]);
  if (source.fields?.length)
    details.push([t('patientFields', 'Patient fields'), source.fields.join(', ')]);
  return (
    <Stack gap={4}>
      <div className={styles.sourcesToolbar}>
        <h4>{sourceKey}</h4>
        <div>
          <Button kind="ghost" size="sm" renderIcon={Edit} onClick={onEdit}>
            {t('edit', 'Edit')}
          </Button>
          <Button
            kind="danger--ghost"
            size="sm"
            disabled={widgetUsage.length > 0}
            title={
              widgetUsage.length
                ? t('sourceInUse', 'Remove widget bindings before deleting this source.')
                : undefined
            }
            onClick={onDelete}>
            {t('delete', 'Delete')}
          </Button>
        </div>
      </div>
      <dl className={styles.sourceDetailGrid}>
        {details.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {source.type === 'registered' && !sourceResource(source) && (
        <p className={styles.sectionHint}>
          {t('registeredSourceNoResource', 'This registered resolver selects its own cohort and references no terminology resource.')}
        </p>
      )}
      <h5>{t('whereUsed', 'Where this source is used')}</h5>
      <p className={styles.sectionHint}>
        {t(
          'whereUsedHint',
          'Widgets bind to the source key. Rules reference the same resource alias and are listed for awareness only.',
        )}
      </p>
      {!widgetUsage.length && !aliasReferences.length && (
        <p>{t('notUsedYet', 'This source is not referenced by any widget or rule.')}</p>
      )}
      {widgetUsage.length > 0 && (
        <>
          <p className={styles.sectionHint}>{t('widgetBindings', 'Widget bindings ({{count}})', { count: widgetUsage.length })}</p>
          <ul className={styles.usageList}>
            {widgetUsage.map((usage) => (
              <li key={usage.id}>
                {usage.name} <span className={styles.sectionHint}>{usage.location}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {aliasReferences.length > 0 && (
        <>
          <p className={styles.sectionHint}>
            {t('aliasReferences', 'Rules referencing alias {{alias}}', { alias: alias ?? '' })}
          </p>
          <ul className={styles.usageList}>
            {aliasReferences.map((usage) => (
              <li key={`${usage.location}-${usage.id}-${usage.name}`}>
                {usage.name} <span className={styles.sectionHint}>{usage.location}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Stack>
  );
}
