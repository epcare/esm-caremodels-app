import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTable,
  Dropdown,
  InlineLoading,
  InlineNotification,
  Modal,
  Pagination,
  Search,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextArea,
  TextInput,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { ErrorState, UserHasAccess } from '@openmrs/esm-framework';
import {
  changeModelStatus,
  duplicateModel,
  fetchEnvelope,
  importModel,
  publishModel,
  useRegistry,
  validateDefinition,
} from '../api/caremodels.resource';
import { parseEnvelope } from '../api/contract';
import { navigateToCareModelAdmin } from '../utils/care-model-navigation';
import type { RegistryModel } from '../types/caremodels';
import { PrivilegeSelector } from './privilege-selector.component';
import styles from './care-models-admin-home.scss';

type RegistryAction = 'duplicate' | 'import' | 'publish' | 'deactivate' | 'reactivate';
export default function CareModelsAdminHome() {
  return (
    <UserHasAccess privilege="Task: caremodels.model.manage">
      <Registry />
    </UserHasAccess>
  );
}

function Registry() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const { data: models, error, isLoading, mutate } = useRegistry(query);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialog, setDialog] = useState<{ action: RegistryAction; model?: RegistryModel } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [privilege, setPrivilege] = useState('');
  const [json, setJson] = useState('');
  const [version, setVersion] = useState('');
  const filtered = useMemo(
    () =>
      (models ?? []).filter(
        (model) =>
          (status === 'ALL' || model.status === status) &&
          `${model.code} ${model.name}`.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [models, status, search],
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((model) => ({
    id: model.uuid,
    name: model.name,
    code: model.code,
    status: model.status,
    privilege: model.privilege,
    revision: model.revision,
  }));
  const headers = [
    { key: 'name', header: t('modelName', 'Model') },
    { key: 'code', header: t('modelCode', 'Code') },
    { key: 'status', header: t('status', 'Status') },
    { key: 'privilege', header: t('requiredPrivilege', 'Required privilege') },
    { key: 'revision', header: t('revision', 'Revision') },
  ];
  const open = (action: RegistryAction, model?: RegistryModel) => {
    setCode('');
    setName('');
    setPrivilege('');
    setJson('');
    setVersion('');
    setMessage(null);
    setDialog({ action, model });
  };
  const report = (error: unknown) =>
    setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
  const validate = async (model: RegistryModel) => {
    setBusy(true);
    setMessage(null);
    try {
      const envelope = parseEnvelope((await fetchEnvelope(model.code)).envelope);
      const result = await validateDefinition((envelope.draft ?? envelope.published)!.definition);
      setMessage({
        kind: result.valid ? 'success' : 'error',
        text: result.valid
          ? t('validationPassed', 'Definition is valid')
          : (result.validationErrors ?? t('validationFailed', 'Definition is invalid')),
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };
  const exportModel = async (model: RegistryModel) => {
    setBusy(true);
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
      else if (dialog.action === 'import') await importModel(code.trim(), name.trim(), privilege, parseEnvelope(json));
      else if (dialog.action === 'publish') {
        const envelope = parseEnvelope((await fetchEnvelope(dialog.model!.code)).envelope);
        if (!envelope.draft) throw new Error(t('noDraft', 'There is no draft to publish.'));
        const result = await publishModel(dialog.model!.code, version, envelope.revision);
        if (result.conflict) throw new Error(t('staleRevisionShort', 'Draft changed elsewhere; reload and retry.'));
      } else await changeModelStatus(dialog.model!.code, dialog.action);
      setDialog(null);
      await mutate();
      setMessage({ kind: 'success', text: t('operationSucceeded', 'Care model updated') });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };
  const requiresIdentity = dialog?.action === 'duplicate' || dialog?.action === 'import';
  return (
    <div className={styles.container}>
      <h2>{t('careModels', 'Care Models')}</h2>
      <p className={styles.subtitle}>{t('careModelsAdminSubtitle', 'Create, manage and publish care models.')}</p>
      {message && (
        <InlineNotification kind={message.kind} title={message.text} onCloseButtonClick={() => setMessage(null)} />
      )}
      <div className={styles.filtersRow}>
        <Search
          labelText={t('search', 'Search')}
          placeholder={t('searchCareModels', 'Search care models…')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Dropdown
          id="status-filter"
          titleText={t('status', 'Status')}
          label={t('status', 'Status')}
          items={['ALL', 'DRAFT', 'PUBLISHED', 'INACTIVE', 'RETIRED']}
          selectedItem={status}
          onChange={({ selectedItem }) => {
            setStatus(selectedItem ?? 'ALL');
            setPage(1);
          }}
        />
        <Button kind="tertiary" onClick={() => open('import')} disabled={busy}>
          {t('importModel', 'Import')}
        </Button>
        <Button renderIcon={Add} onClick={() => navigateToCareModelAdmin('new')}>
          {t('newCareModel', 'New Care Model')}
        </Button>
      </div>
      {isLoading ? (
        <InlineLoading description={t('loading', 'Loading…')} />
      ) : error ? (
        <ErrorState headerTitle={t('careModels', 'Care Models')} error={error} />
      ) : (
        <>
          <DataTable rows={rows} headers={headers}>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()}>
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
                    {rows.map((row) => {
                      const model = models?.find((item) => item.uuid === row.id);
                      if (!model) return null;
                      const { key, ...props } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...props}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'status' ? (
                                <Tag type={cell.value === 'PUBLISHED' ? 'green' : 'gray'}>{String(cell.value)}</Tag>
                              ) : (
                                cell.value
                              )}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button kind="ghost" size="sm" onClick={() => navigateToCareModelAdmin(model.code)}>
                              {t('edit', 'Edit')}
                            </Button>
                            <OverflowMenu
                              aria-label={`${t('actions', 'Actions')}: ${model.name}`}
                              iconDescription={`${t('actions', 'Actions')}: ${model.name}`}
                              disabled={busy}
                              flipped>
                              <OverflowMenuItem
                                itemText={t('duplicate', 'Duplicate published model')}
                                disabled={model.status === 'DRAFT' || model.retired}
                                onClick={() => open('duplicate', model)}
                              />
                              <OverflowMenuItem
                                itemText={t('validate', 'Validate')}
                                onClick={() => void validate(model)}
                              />
                              <OverflowMenuItem
                                itemText={t('exportModel', 'Export configuration')}
                                onClick={() => void exportModel(model)}
                              />
                              <UserHasAccess privilege="Task: caremodels.model.publish">
                                <OverflowMenuItem
                                  itemText={t('publish', 'Publish')}
                                  disabled={model.retired}
                                  onClick={() => open('publish', model)}
                                />
                              </UserHasAccess>
                              <OverflowMenuItem
                                itemText={
                                  model.status === 'INACTIVE'
                                    ? t('reactivate', 'Reactivate')
                                    : t('deactivate', 'Deactivate')
                                }
                                disabled={model.retired || !['PUBLISHED', 'INACTIVE'].includes(model.status)}
                                onClick={() => open(model.status === 'INACTIVE' ? 'reactivate' : 'deactivate', model)}
                              />
                            </OverflowMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {!rows.length && (
                  <p className={styles.emptyState}>{t('noRegistryModels', 'No care models match these filters.')}</p>
                )}
              </TableContainer>
            )}
          </DataTable>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            pageSizes={[10, 20, 50]}
            totalItems={filtered.length}
            onChange={({ page, pageSize }) => {
              setPage(page);
              setPageSize(pageSize);
            }}
          />
        </>
      )}
      <Modal
        open={Boolean(dialog)}
        modalHeading={dialog ? t(dialog.action, dialog.action) : ''}
        primaryButtonText={busy ? t('working', 'Working…') : t('confirm', 'Confirm')}
        secondaryButtonText={t('cancel', 'Cancel')}
        primaryButtonDisabled={
          busy ||
          (requiresIdentity && (!code.trim() || !name.trim() || !privilege)) ||
          (dialog?.action === 'publish' && !/^\d+\.\d+\.\d+$/.test(version)) ||
          (dialog?.action === 'import' && !json.trim())
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
                onChange={(e) => setCode(e.target.value)}
              />
              <TextInput
                id="registry-name"
                labelText={t('modelName', 'Name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <PrivilegeSelector value={privilege} onChange={setPrivilege} />
            </>
          )}
          {dialog?.action === 'import' && (
            <TextArea
              id="registry-envelope"
              labelText={t('importEnvelope', 'Storage envelope JSON')}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={8}
            />
          )}
          {dialog?.action === 'publish' && (
            <TextInput
              id="registry-version"
              labelText={t('releaseVersion', 'Release version')}
              placeholder="1.0.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          )}
          {(dialog?.action === 'deactivate' || dialog?.action === 'reactivate') && (
            <p>{t('confirmLifecycle', 'Change the local availability of {{name}}?', { name: dialog.model?.name })}</p>
          )}
          {message?.kind === 'error' && <InlineNotification kind="error" title={message.text} hideCloseButton />}
        </Stack>
      </Modal>
    </div>
  );
}
