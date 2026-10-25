import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  FileUploaderButton,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  Link,
  Modal,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Search,
  Tag,
  TextArea,
  TextInput,
  Tile,
} from '@carbon/react';
import { Add, Copy, Download, Edit, Group, Pause, Play, Upload } from '@carbon/react/icons';
import { UserHasAccess } from '@openmrs/esm-framework';
import { changeModelStatus, duplicateModel, fetchEnvelope, importModel, useRegistry } from '../api/caremodels.resource';
import { manageModelPrivilege } from '../constants';
import { importWorkspaceDraft } from './workspace-import';
import { parseEnvelope } from '../api/contract';
import { careModelAdminUrl, navigateToCareModelAdmin } from '../utils/care-model-navigation';
import type { RegistryModel } from '../types/caremodels';
import { PrivilegeSelector } from './privilege-selector.component';
import { CareModelsRegistryHeader } from './care-models-registry-header.component';
import styles from './care-models-admin-home.scss';

type RegistryAction = 'duplicate' | 'import' | 'deactivate' | 'reactivate';
type StatusFilter = 'ALL' | RegistryModel['status'];
const modelStatus = (model: RegistryModel) => (model.retired ? 'RETIRED' : model.status);

export default function CareModelsAdminHome() {
  return (
    <UserHasAccess privilege={manageModelPrivilege}>
      <Registry />
    </UserHasAccess>
  );
}

function Registry() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  // Java retirement uses a separate flag; status=RETIRED alone can miss retired published models.
  const {
    data: models,
    error,
    isLoading,
    mutate,
  } = useRegistry(query, status === 'ALL' || status === 'RETIRED' ? undefined : status);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialog, setDialog] = useState<{ action: RegistryAction; model?: RegistryModel } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [privilege, setPrivilege] = useState('');
  const [json, setJson] = useState('');
  const workspaceImport = useMemo(() => {
    try {
      const value = JSON.parse(json);
      return value?.schemaVersion !== undefined && value?.storageSchemaVersion === undefined;
    } catch {
      return false;
    }
  }, [json]);
  const filtered = useMemo(
    () =>
      (models ?? []).filter(
        (model) =>
          (status === 'ALL' || modelStatus(model) === status) &&
          `${model.name} ${model.code}`.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [models, status, search],
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((model) => ({
    id: model.uuid,
    name: model.name,
    code: model.code,
    status: modelStatus(model),
    privilege: model.privilege,
    revision: model.revision,
  }));
  const headers = [
    { key: 'name', header: t('name', 'Name') },
    { key: 'code', header: t('modelCode', 'Code') },
    { key: 'status', header: t('status', 'Status') },
    { key: 'privilege', header: t('registryViewingPrivilege', 'Required viewing privilege') },
    { key: 'revision', header: t('revision', 'Revision') },
  ];
  const statusLabels: Record<StatusFilter, string> = {
    ALL: t('allStatuses', 'All statuses'),
    DRAFT: t('registryDraft', 'Draft'),
    PUBLISHED: t('registryPublished', 'Published'),
    INACTIVE: t('registryInactive', 'Inactive'),
    RETIRED: t('registryRetired', 'Retired'),
  };
  const hasFilters = Boolean(search.trim()) || status !== 'ALL';
  const loading = isLoading || query !== search.trim();
  const open = (action: RegistryAction, model?: RegistryModel) => {
    setCode('');
    setName('');
    setPrivilege('');
    setJson('');
    setMessage(null);
    setDialog({ action, model });
  };
  const clearFilters = () => {
    setSearch('');
    setStatus('ALL');
    setPage(1);
  };
  const report = (error: unknown) =>
    setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
  const exportModel = async (model: RegistryModel) => {
    setBusy(true);
    setMessage(null);
    try {
      const envelope = parseEnvelope((await fetchEnvelope(model.code)).envelope);
      const url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${model.code}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!dialog || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if ((dialog.action === 'duplicate' || dialog.action === 'import') && code.trim() === 'new')
        throw new Error(t('reservedCode', 'The code new is reserved for model creation. Choose another code.'));
      if (dialog.action === 'duplicate') await duplicateModel(dialog.model!.code, code.trim(), name.trim(), privilege);
      else if (dialog.action === 'import') {
        if (workspaceImport) await importWorkspaceDraft(code.trim(), json);
        else await importModel(code.trim(), name.trim(), privilege, parseEnvelope(json));
      } else await changeModelStatus(dialog.model!.code, dialog.action);
      setDialog(null);
      await mutate();
      setMessage({
        kind: 'success',
        text:
          dialog.action === 'import' && workspaceImport
            ? t('workspaceDraftImported', 'Workspace saved as a draft. The published configuration is unchanged.')
            : t('operationSucceeded', 'Care model updated'),
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };
  const requiresIdentity = dialog?.action === 'duplicate' || (dialog?.action === 'import' && !workspaceImport);
  const dialogTitles: Record<RegistryAction, string> = {
    duplicate: t('duplicateCareModel', 'Duplicate Care Model'),
    import: t('importCareModel', 'Import Care Model'),
    deactivate: t('deactivateCareModel', 'Deactivate Care Model'),
    reactivate: t('reactivateCareModel', 'Reactivate Care Model'),
  };
  return (
    <div className={styles.container}>
      <CareModelsRegistryHeader />
      <section className={styles.content} aria-label={t('careModelsRegistry', 'Care Models registry')}>
        <Stack gap={4}>
          {message && !dialog && (
            <InlineNotification kind={message.kind} title={message.text} onCloseButtonClick={() => setMessage(null)} />
          )}
          <div className={styles.tablePanel}>
            <section className={styles.toolbar} aria-label={t('registryToolbar', 'Registry controls')}>
              <div className={styles.controls}>
                <div className={styles.filterRow}>
                  <Dropdown
                    id="status-filter"
                    size="lg"
                    titleText={t('filterBy', 'Filter by')}
                    label={t('allStatuses', 'All statuses')}
                    items={Object.keys(statusLabels) as Array<StatusFilter>}
                    itemToString={(item) => (item ? statusLabels[item] : '')}
                    selectedItem={status}
                    onChange={({ selectedItem }) => {
                      setStatus(selectedItem ?? 'ALL');
                      setPage(1);
                    }}
                  />
                </div>
                <Search
                  className={styles.search}
                  size="lg"
                  labelText={t('searchCareModelsLabel', 'Search care models')}
                  placeholder={t('searchCareModels', 'Search care models…')}
                  value={search}
                  onChange={(event) => {
                    if (event && 'target' in event) {
                      setSearch(event.target.value);
                      setPage(1);
                    }
                  }}
                />
                <Button kind="tertiary" renderIcon={Upload} onClick={() => open('import')} disabled={busy}>
                  {t('importModel', 'Import')}
                </Button>
                <Button renderIcon={Add} onClick={() => navigateToCareModelAdmin('new')}>
                  {t('createNewCareModel', 'Create New Care Model')}
                </Button>
              </div>
            </section>
            {error ? (
              <div className={styles.errorState}>
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title={t('registryLoadError', 'Could not load Care Models')}
                  subtitle={t('registryLoadErrorDescription', 'Check your access and connection, then try again.')}
                />
                <Button kind="tertiary" onClick={() => void mutate().catch(report)}>
                  {t('retry', 'Retry')}
                </Button>
              </div>
            ) : loading ? (
              <DataTableSkeleton
                columnCount={6}
                rowCount={10}
                showHeader={false}
                showToolbar={false}
                headers={headers}
                aria-label={t('loadingCareModels', 'Loading Care Models')}
              />
            ) : !filtered.length ? (
              <TableContainer>
                <div className={styles.tableRegion}>
                  <Table size="sm">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader key={header.key}>{header.header}</TableHeader>
                        ))}
                        <TableHeader>{t('actions', 'Actions')}</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={6} className={styles.emptyCell}>
                          <Tile className={styles.emptyState}>
                            <Group size={64} aria-hidden />
                            <h2>
                              {hasFilters
                                ? t('noRegistryFilterMatches', 'No Care Models match these filters.')
                                : t('noCareModelsAvailable', 'No Care Models available')}
                            </h2>
                            <p>
                              {hasFilters
                                ? t('clearRegistryFiltersHint', 'Try another search or clear your filters.')
                                : t(
                                    'createCareModelHint',
                                    'Create a Care Model to configure specialized clinical workspaces for enrolled patients.',
                                  )}
                            </p>
                            {hasFilters && (
                              <Button kind="tertiary" onClick={clearFilters}>
                                {t('clearSearchAndFilters', 'Clear search and filters')}
                              </Button>
                            )}
                          </Tile>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TableContainer>
            ) : (
              <>
                <div
                  className={styles.tableRegion}
                  role="region"
                  aria-label={t('careModelsTable', 'Care Models table')}
                  tabIndex={0}>
                  <DataTable rows={rows} headers={headers} size="sm" useZebraStyles>
                    {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                      <TableContainer>
                        <Table {...getTableProps()} size="sm" useZebraStyles>
                          <TableHead>
                            <TableRow>
                              {headers.map((header) => {
                                const { key, ...props } = getHeaderProps({ header });
                                return (
                                  <TableHeader key={key} {...props}>
                                    {header.header}
                                  </TableHeader>
                                );
                              })}
                              <TableHeader>{t('actions', 'Actions')}</TableHeader>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {tableRows.map((row) => {
                              const model = models?.find((model) => model.uuid === row.id);
                              if (!model) return null;
                              const { key, ...props } = getRowProps({ row });
                              const duplicateUnavailable = model.status === 'DRAFT' || model.retired;
                              const lifecycleUnavailable =
                                model.retired || !['PUBLISHED', 'INACTIVE'].includes(model.status);
                              const reactivate = model.status === 'INACTIVE';
                              const duplicateLabel = duplicateUnavailable
                                ? t('duplicateUnavailable', 'Duplicate unavailable for unpublished or retired models')
                                : t('duplicateModelName', 'Duplicate {{name}}', { name: model.name });
                              const lifecycleLabel = lifecycleUnavailable
                                ? t(
                                    'lifecycleUnavailable',
                                    'Availability changes require a published, non-retired model',
                                  )
                                : reactivate
                                  ? t('reactivateModelName', 'Reactivate {{name}}', { name: model.name })
                                  : t('deactivateModelName', 'Deactivate {{name}}', { name: model.name });
                              return (
                                <TableRow key={key} {...props}>
                                  {row.cells.map((cell) => (
                                    <TableCell
                                      key={cell.id}
                                      className={cell.info.header === 'privilege' ? styles.privilegeCell : undefined}>
                                      {cell.info.header === 'name' ? (
                                        <div className={styles.modelIdentity}>
                                          <Link
                                            href={careModelAdminUrl(model.code)}
                                            onClick={(event) => {
                                              if (
                                                event.button === 0 &&
                                                !event.metaKey &&
                                                !event.ctrlKey &&
                                                !event.shiftKey &&
                                                !event.altKey
                                              ) {
                                                event.preventDefault();
                                                navigateToCareModelAdmin(model.code);
                                              }
                                            }}>
                                            {model.name}
                                          </Link>
                                          {model.description && (
                                            <p className={styles.modelDescription}>{model.description}</p>
                                          )}
                                        </div>
                                      ) : cell.info.header === 'status' ? (
                                        <Tag
                                          type={
                                            cell.value === 'PUBLISHED'
                                              ? 'green'
                                              : cell.value === 'INACTIVE'
                                                ? 'warm-gray'
                                                : 'gray'
                                          }
                                          size="sm">
                                          {statusLabels[String(cell.value) as StatusFilter]}
                                        </Tag>
                                      ) : cell.info.header === 'privilege' ? (
                                        <span title={model.privilege}>{model.privilege}</span>
                                      ) : (
                                        cell.value
                                      )}
                                    </TableCell>
                                  ))}
                                  <TableCell>
                                    <div className={styles.rowActions}>
                                      <Button
                                        kind="ghost"
                                        size="sm"
                                        hasIconOnly
                                        renderIcon={Edit}
                                        iconDescription={t('editModelName', 'Edit {{name}}', { name: model.name })}
                                        onClick={() => navigateToCareModelAdmin(model.code)}
                                      />
                                      <Button
                                        kind="ghost"
                                        size="sm"
                                        hasIconOnly
                                        renderIcon={Download}
                                        disabled={busy}
                                        iconDescription={t('exportModelName', 'Export {{name}}', { name: model.name })}
                                        onClick={() => void exportModel(model)}
                                      />
                                      <Button
                                        kind="ghost"
                                        size="sm"
                                        hasIconOnly
                                        renderIcon={Copy}
                                        disabled={busy || duplicateUnavailable}
                                        iconDescription={duplicateLabel}
                                        title={duplicateLabel}
                                        onClick={() => open('duplicate', model)}
                                      />
                                      <Button
                                        kind="ghost"
                                        size="sm"
                                        hasIconOnly
                                        renderIcon={reactivate ? Play : Pause}
                                        disabled={busy || lifecycleUnavailable}
                                        iconDescription={lifecycleLabel}
                                        title={lifecycleLabel}
                                        onClick={() => open(reactivate ? 'reactivate' : 'deactivate', model)}
                                      />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </DataTable>
                </div>
              </>
            )}
            {!error && !loading && (
              <Pagination
                className={styles.pagination}
                page={currentPage}
                pageSize={pageSize}
                pageSizes={[10, 20, 50]}
                totalItems={filtered.length}
                itemsPerPageText={t('itemsPerPage', 'Items per page:')}
                onChange={({ page, pageSize }) => {
                  setPage(page);
                  setPageSize(pageSize);
                }}
              />
            )}
          </div>
        </Stack>
      </section>
      {dialog && (
        <Modal
          open
          modalHeading={dialogTitles[dialog.action]}
          primaryButtonText={busy ? t('working', 'Working…') : t('confirm', 'Confirm')}
          secondaryButtonText={t('cancel', 'Cancel')}
          primaryButtonDisabled={
            busy ||
            (requiresIdentity && (!code.trim() || !name.trim() || !privilege)) ||
            (dialog.action === 'import' && (!json.trim() || !code.trim()))
          }
          onRequestClose={() => !busy && setDialog(null)}
          onRequestSubmit={() => void submit()}
          preventCloseOnClickOutside>
          <Stack gap={5}>
            {requiresIdentity && (
              <>
                <TextInput
                  id="registry-code"
                  labelText={t('modelCode', 'Code')}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <TextInput
                  id="registry-name"
                  labelText={t('modelName', 'Name')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <PrivilegeSelector value={privilege} onChange={setPrivilege} />
              </>
            )}
            {dialog.action === 'import' && (
              <>
                <p>
                  {t(
                    'importFormatHelp',
                    'Import an exported storage envelope to create a model, or a workspace definition to update an existing model draft.',
                  )}
                </p>
                <FileUploaderButton
                  labelText={t('chooseImportJson', 'Choose JSON file')}
                  accept={['.json']}
                  multiple={false}
                  disableLabelChanges
                  disabled={busy}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      if (file.size > 2 * 1024 * 1024)
                        throw new Error(
                          t('workspaceImportTooLarge', 'The workspace update must be smaller than 2 MB.'),
                        );
                      setJson(await file.text());
                    } catch (error) {
                      report(error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <TextArea
                  id="registry-envelope"
                  labelText={
                    workspaceImport
                      ? t('workspaceDefinitionJson', 'Workspace definition JSON')
                      : t('importEnvelope', 'Storage envelope JSON')
                  }
                  value={json}
                  disabled={busy}
                  onChange={(event) => setJson(event.target.value)}
                  rows={8}
                />
                {workspaceImport && (
                  <>
                    <InlineNotification
                      kind="info"
                      hideCloseButton
                      title={t('workspaceDefinitionDetected', 'Workspace definition detected')}
                      subtitle={t(
                        'existingWorkspaceImportHelp',
                        'Enter the existing model code, such as HIV. Confirm validates and saves a draft while preserving identity, viewing privilege, enrollment policy and existing form UUIDs. New form associations require exact catalog verification. Nothing is published.',
                      )}
                    />
                    <TextInput
                      id="registry-existing-code"
                      labelText={t('existingModelCode', 'Existing model code')}
                      value={code}
                      disabled={busy}
                      onChange={(event) => setCode(event.target.value)}
                    />
                  </>
                )}
              </>
            )}
            {(dialog.action === 'deactivate' || dialog.action === 'reactivate') && (
              <p>{t('confirmLifecycle', 'Change the local availability of {{name}}?', { name: dialog.model?.name })}</p>
            )}
            {message?.kind === 'error' && <InlineNotification kind="error" title={message.text} hideCloseButton />}
          </Stack>
        </Modal>
      )}
    </div>
  );
}
