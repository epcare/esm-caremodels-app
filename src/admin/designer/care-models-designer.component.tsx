import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  InlineLoading,
  InlineNotification,
  Modal,
  Select,
  SelectItem,
  Stack,
  Tag,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Tile,
  Link,
  TextArea,
  TextInput,
} from '@carbon/react';
import { ArrowLeft, Group, Code, View, CheckmarkOutline } from '@carbon/react/icons';
import { UserHasAccess } from '@openmrs/esm-framework';
import {
  createModel,
  fetchEnvelope,
  fetchModel,
  publishModel,
  saveDraft,
  updateModelMetadata,
  validateDefinition,
} from '../../api/caremodels.resource';
import { parseEnvelope } from '../../api/contract';
import {
  careModelAdminUrl,
  getModelCodeFromLocation,
  navigateToCareModelAdmin,
} from '../../utils/care-model-navigation';
import type { ModelDefinition } from '../../types/caremodels';
import { PrivilegeSelector } from '../privilege-selector.component';
import { blankDefinition, nextVersion } from './definition';
import { WorkspaceEditor } from './workspace-editor.component';
import {
  ActionsEditor,
  DataSourcesEditor,
  EnrollmentEditor,
  FormsEditor,
  PathwayEditor,
} from './configuration-editors.component';
import { DefinitionJsonEditor } from './definition-json-editor.component';
import { ModelPreview } from './model-preview.component';
import { widgetBindingErrors } from '../../widgets/widget-registry';
import { parseDefinitionJson } from './definition-validation';
import styles from './designer.scss';

const sectionLabels = [
  'General',
  'Enrollment Rules',
  'Workspace',
  'Data Sources',
  'Forms',
  'Actions',
  'Care Pathway',
  'Review',
];
const sectionDescriptions = [
  'Basic model information',
  'Define patient eligibility',
  'Design patient workspace',
  'Configure clinical data',
  'Add and configure forms',
  'Patient and system actions',
  'Configure the care pathway',
  'Validate and publish',
];
const steps = [
  'general',
  'enrollmentRules',
  'workspace',
  'dataSources',
  'forms',
  'actions',
  'carePathway',
  'review',
] as const;
type Step = (typeof steps)[number];
function subscribe(onChange: () => void) {
  window.addEventListener('single-spa:routing-event', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('single-spa:routing-event', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

export default function CareModelsDesigner() {
  const modelCode = useSyncExternalStore(subscribe, getModelCodeFromLocation);
  return (
    <UserHasAccess privilege="Task: caremodels.model.manage">
      <ModelEditor key={modelCode ?? 'new'} modelCode={modelCode} />
    </UserHasAccess>
  );
}

export function ModelEditor({ modelCode }: { modelCode: string | null }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('general');
  const [code, setCode] = useState(modelCode ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privilege, setPrivilege] = useState('');
  const [definition, setDefinition] = useState<ModelDefinition>(blankDefinition);
  const [revision, setRevision] = useState(0);
  const [modelStatus, setModelStatus] = useState('DRAFT');
  const [version, setVersion] = useState('1.0.0');
  const [publishedVersion, setPublishedVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'validating' | 'publishing'>('idle');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [loaded, setLoaded] = useState(!modelCode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState(0);
  const [jsonBuffer, setJsonBuffer] = useState<string | null>(null);
  const [validationFailure, setValidationFailure] = useState<{ definition: string; message: string } | null>(null);
  const definitionJson = JSON.stringify(definition, null, 2);
  const jsonErrors = useMemo(() => (jsonBuffer === null ? [] : parseDefinitionJson(jsonBuffer).errors), [jsonBuffer]);
  const invalidJson = jsonErrors.length > 0;
  const unresolvedValidation = validationFailure !== null;
  const editJson = (text: string) => {
    setJsonBuffer(text);
    const parsed = parseDefinitionJson(text);
    if (parsed.definition) setDefinition(parsed.definition);
  };
  const editDefinition = (value: ModelDefinition) => {
    setDefinition(value);
    if (!invalidJson) setJsonBuffer(null);
  };
  const [publishDialog, setPublishDialog] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({ definition: blankDefinition(), name: '', description: '', privilege: '', code: modelCode ?? '' }),
  );
  const [reload, setReload] = useState(0);
  const operationInProgress = useRef(false);
  const metadata = { name, description, privilege };
  const serialized = JSON.stringify({ definition, ...metadata, code });
  const dirty = baseline !== serialized || invalidJson;

  useEffect(() => {
    if (!modelCode) return;
    let cancelled = false;
    setLoaded(false);
    setLoadError(null);
    Promise.all([fetchEnvelope(modelCode), fetchModel(modelCode)])
      .then(([result, model]) => {
        if (cancelled) return;
        const envelope = parseEnvelope(result.envelope);
        const draft = (envelope.draft ?? envelope.published)!.definition;
        setDefinition(draft);
        setRevision(envelope.revision);
        setName(model.name);
        setDescription(model.description ?? '');
        setPrivilege(model.privilege);
        setModelStatus(model.status);
        setPublishedVersion(envelope.published?.version ?? null);
        setVersion(nextVersion(envelope.published?.version));
        setBaseline(
          JSON.stringify({
            definition: draft,
            name: model.name,
            description: model.description ?? '',
            privilege: model.privilege,
            code: modelCode,
          }),
        );
        setLoaded(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [modelCode, reload]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);

  const run = async (busyStatus: typeof status, task: () => Promise<void>) => {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setStatus(busyStatus);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      operationInProgress.current = false;
      setStatus('idle');
    }
  };
  const checkConflict = (result: { conflict?: boolean; currentRevision?: number }) => {
    if (result.conflict)
      throw new Error(
        t('staleRevision', 'This draft was changed by someone else (now at revision {{revision}}).', {
          revision: result.currentRevision ?? '?',
        }),
      );
  };
  const persist = async () => {
    if (invalidJson)
      throw new Error(t('resolveJsonBeforeSave', 'Resolve or reset the invalid JSON changes before saving.'));
    if (code.trim() === 'new')
      throw new Error(t('reservedCode', 'The code new is reserved for model creation. Choose another code.'));
    if (!code.trim() || !name.trim() || !privilege || privilege === 'View Care Models')
      throw new Error(
        t('requiredModelIdentity', 'A code, name, and distinct registered viewing privilege are required.'),
      );
    const result = modelCode
      ? await saveDraft(modelCode, definition, revision)
      : await createModel({ code: code.trim(), ...metadata, definition });
    checkConflict(result);
    if (!Number.isInteger(result.revision))
      throw new Error(t('missingRevision', 'The server did not return a revision. Reload before continuing.'));
    // Record revision before metadata update: a metadata failure must not cause a stale retry.
    setRevision(result.revision!);
    if (modelCode) await updateModelMetadata(modelCode, metadata);
    setBaseline(serialized);
    return result;
  };
  const save = () =>
    run('saving', async () => {
      const result = await persist();
      setMessage({ kind: 'success', text: t('draftSaved', 'Draft saved') });
      if (!modelCode && result.modelCode) navigateToCareModelAdmin(result.modelCode, { replace: true });
    });
  const validate = () =>
    run('validating', async () => {
      if (invalidJson) {
        setMode(1);
        throw new Error(jsonErrors.join('\n'));
      }
      const bindingErrors = widgetBindingErrors(definition);
      if (bindingErrors.length) {
        const text = bindingErrors.join('\n');
        setValidationFailure({ definition: JSON.stringify(definition), message: text });
        throw new Error(text);
      }
      const result = await validateDefinition(definition);
      setValidationFailure(
        result.valid
          ? null
          : {
              definition: JSON.stringify(definition),
              message: result.validationErrors ?? t('validationFailed', 'Definition is invalid'),
            },
      );
      setMessage({
        kind: result.valid ? 'success' : 'error',
        text: result.valid
          ? t('validationPassed', 'Definition is valid')
          : (result.validationErrors ?? t('validationFailed', 'Definition is invalid')),
      });
    });
  const publish = () =>
    run('publishing', async () => {
      if (!modelCode || !/^\d+\.\d+\.\d+$/.test(version))
        throw new Error(t('validVersionRequired', 'Save the model and enter a semantic release version.'));
      const bindingErrors = widgetBindingErrors(definition);
      if (bindingErrors.length) {
        const text = bindingErrors.join('\n');
        setValidationFailure({ definition: JSON.stringify(definition), message: text });
        throw new Error(text);
      }
      const validation = await validateDefinition(definition);
      if (!validation.valid) {
        setValidationFailure({
          definition: JSON.stringify(definition),
          message: validation.validationErrors ?? t('validationFailed', 'Definition is invalid'),
        });
        throw new Error(validation.validationErrors ?? t('validationFailed', 'Definition is invalid'));
      }
      setValidationFailure(null);
      // Persist the exact edited definition, then publish using the revision from that save.
      const saved = await persist();
      const result = await publishModel(modelCode, version, saved.revision!);
      checkConflict(result);
      if (!Number.isInteger(result.revision))
        throw new Error(t('missingRevision', 'The server did not return a revision. Reload before continuing.'));
      setRevision(result.revision!);
      setModelStatus(result.status ?? 'PUBLISHED');
      setPublishedVersion(version);
      setVersion(nextVersion(version));
      setPublishDialog(false);
      setMessage({ kind: 'success', text: t('publishedRelease', 'Published version {{version}}', { version }) });
    });

  if (!loaded) return <InlineLoading description={t('loading', 'Loading…')} />;
  if (loadError)
    return (
      <Stack gap={4}>
        <InlineNotification
          kind="error"
          title={t('designerLoadError', 'Could not load this care model draft.')}
          subtitle={loadError}
          hideCloseButton
        />
        <Button onClick={() => setReload((n) => n + 1)}>{t('retry', 'Retry')}</Button>
      </Stack>
    );
  const currentIndex = steps.indexOf(step);
  return (
    <div className={styles.designer}>
      <Link
        href={careModelAdminUrl()}
        onClick={(event) => {
          if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
            event.preventDefault();
            if (dirty) setLeaveDialog(true);
            else navigateToCareModelAdmin();
          }
        }}
        renderIcon={ArrowLeft}>
        {t('backToCareModels', 'Back to Care Models')}
      </Link>
      <div className={styles.designerHeader}>
        <Group size={48} className={styles.designerIcon} aria-hidden />
        <div className={styles.designerTitle}>
          <p className={styles.moduleLabel}>{t('careModels', 'Care Models')}</p>
          <h1>{modelCode ? t('editCareModel', 'Edit Care Model') : t('createCareModel', 'Create Care Model')}</h1>
          <div className={styles.modelState}>
            {(name || code) && <strong>{name || code}</strong>}
            <Tag type={modelStatus === 'PUBLISHED' ? 'green' : 'blue'}>{modelStatus}</Tag>
            <span>{t('revisionNumber', 'Revision {{revision}}', { revision })}</span>
            {dirty && <Tag type="warm-gray">{t('unsavedChanges', 'Unsaved changes')}</Tag>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button kind="tertiary" onClick={() => setMode(2)}>
            {t('preview', 'Preview')}
          </Button>
          <Button kind="secondary" onClick={() => void validate()} disabled={status !== 'idle'}>
            {t('validate', 'Validate')}
          </Button>
          <Button onClick={() => void save()} disabled={status !== 'idle' || invalidJson}>
            {status === 'saving' ? t('saving', 'Saving…') : t('saveDraft', 'Save draft')}
          </Button>
          <UserHasAccess privilege="Task: caremodels.model.publish">
            <Button
              onClick={() => setPublishDialog(true)}
              disabled={
                status !== 'idle' || !modelCode || modelStatus === 'RETIRED' || invalidJson || unresolvedValidation
              }>
              {t('publish', 'Publish')}
            </Button>
          </UserHasAccess>
        </div>
      </div>
      {message && (
        <InlineNotification
          kind={message.kind}
          title={message.kind === 'error' ? t('problem', 'Problem') : t('success', 'Success')}
          subtitle={message.text}
          onCloseButtonClick={() => setMessage(null)}
        />
      )}
      {invalidJson && mode !== 1 && (
        <InlineNotification
          kind="warning"
          hideCloseButton
          title={t(
            'pendingInvalidJson',
            'The JSON editor has invalid unsaved changes. Saving and publishing are disabled until they are resolved or reset.',
          )}
        />
      )}
      <Tabs selectedIndex={mode} onChange={({ selectedIndex }) => setMode(selectedIndex)}>
        <TabList aria-label={t('designerEditorModes', 'Designer editor modes')}>
          <Tab>{t('visualBuilder', 'Visual Builder')}</Tab>
          <Tab>{t('jsonEditor', 'JSON Editor')}</Tab>
          <Tab>{t('preview', 'Preview')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className={`${styles.editorLayout} ${step === 'workspace' ? styles.workspaceLayout : ''}`}>
              <nav aria-label={t('configurationSections', 'Configuration sections')}>
                <ol className={styles.stepNav}>
                  {steps.map((candidate, index) => (
                    <li key={candidate}>
                      <Button
                        kind={candidate === step ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setStep(candidate)}
                        aria-current={candidate === step ? 'step' : undefined}>
                        <span className={styles.stepNumber}>{index + 1}</span>
                        <span>
                          <strong>{t(`step.${candidate}`, sectionLabels[index])}</strong>
                          <span className={styles.sectionHint}>
                            {t(`stepHint.${candidate}`, sectionDescriptions[index])}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ol>
              </nav>
              <div className={styles.stepBody}>
                <h2>{t(`step.${step}`, sectionLabels[currentIndex])}</h2>
                <p className={styles.sectionDescription}>{t(`stepHint.${step}`, sectionDescriptions[currentIndex])}</p>
                <fieldset disabled={status !== 'idle'} className={styles.editorFields}>
                  {step === 'general' && (
                    <div className={styles.generalGrid}>
                      <TextInput
                        id="designer-code"
                        labelText={t('modelCode', 'Code')}
                        value={code}
                        helperText={t('modelCodeHint', 'Unique model code. Use lowercase letters and hyphens.')}
                        disabled={Boolean(modelCode)}
                        onChange={(e) => setCode(e.target.value)}
                      />
                      <TextInput
                        id="designer-name"
                        labelText={t('modelName', 'Name')}
                        value={name}
                        helperText={t('modelNameHint', 'Human-readable name for this care model.')}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <div className={styles.fullWidth}>
                        <TextInput
                          id="designer-display-label"
                          labelText={t('patientDisplayLabel', 'Patient display label')}
                          value={definition.metadata.display.label}
                          helperText={t('patientDisplayLabelHint', 'Label shown to users in the patient workspace.')}
                          onChange={(e) =>
                            editDefinition({
                              ...definition,
                              metadata: {
                                ...definition.metadata,
                                display: { ...definition.metadata.display, label: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                      <div className={styles.fullWidth}>
                        <TextArea
                          id="designer-description"
                          labelText={t('description', 'Description')}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <Select
                        id="designer-category"
                        labelText={t('category', 'Category')}
                        value={definition.metadata.category}
                        onChange={(e) =>
                          editDefinition({
                            ...definition,
                            metadata: {
                              ...definition.metadata,
                              category: e.target.value as ModelDefinition['metadata']['category'],
                            },
                          })
                        }>
                        {['CHRONIC_CARE', 'MATERNAL', 'PREVENTIVE', 'SUPPORT'].map((item) => (
                          <SelectItem key={item} value={item} text={item} />
                        ))}
                      </Select>
                      <PrivilegeSelector value={privilege} onChange={setPrivilege} />
                      <TextInput id="designer-status" labelText={t('status', 'Status')} value={modelStatus} readOnly />
                      <TextInput
                        id="release-version"
                        labelText={t('releaseVersion', 'Release version')}
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        helperText={t('publishedVersion', 'Published: {{version}}', {
                          version: publishedVersion ?? t('none', 'None'),
                        })}
                      />
                    </div>
                  )}
                  {step === 'enrollmentRules' && <EnrollmentEditor definition={definition} onChange={editDefinition} />}
                  {step === 'workspace' && <WorkspaceEditor definition={definition} onChange={editDefinition} />}
                  {step === 'dataSources' && <DataSourcesEditor definition={definition} onChange={editDefinition} />}
                  {step === 'forms' && <FormsEditor definition={definition} onChange={editDefinition} />}
                  {step === 'actions' && <ActionsEditor definition={definition} onChange={editDefinition} />}
                  {step === 'carePathway' && <PathwayEditor definition={definition} onChange={editDefinition} />}
                  {step === 'review' && (
                    <Stack gap={5}>
                      <h3>{t('reviewDefinition', 'Review definition')}</h3>
                      <p>
                        {t(
                          'reviewHint',
                          'Validate before publishing. Validation checks resource references and configuration, not unavailable runtime services.',
                        )}
                      </p>
                      <TextArea
                        id="definition-review"
                        labelText={t('definitionJson', 'Definition JSON')}
                        readOnly
                        rows={20}
                        value={JSON.stringify(definition, null, 2)}
                      />
                    </Stack>
                  )}
                </fieldset>
                <div className={styles.wizardFooter}>
                  <Button kind="ghost" disabled={currentIndex === 0} onClick={() => setStep(steps[currentIndex - 1])}>
                    {t('back', 'Back')}
                  </Button>
                  <span className={styles.headerSpacer} />
                  <Button disabled={currentIndex === steps.length - 1} onClick={() => setStep(steps[currentIndex + 1])}>
                    {t('next', 'Next')}
                  </Button>
                </div>
              </div>
              <aside className={styles.summary}>
                <Tile>
                  <h3>{t('modelSummary', 'Model summary')}</h3>
                  <dl className={styles.summaryList}>
                    <dt>{t('modelCode', 'Code')}</dt>
                    <dd>{code || '—'}</dd>
                    <dt>{t('modelName', 'Name')}</dt>
                    <dd>{name || '—'}</dd>
                    <dt>{t('category', 'Category')}</dt>
                    <dd>{definition.metadata.category}</dd>
                    <dt>{t('releaseVersion', 'Release version')}</dt>
                    <dd>{version}</dd>
                    <dt>{t('status', 'Status')}</dt>
                    <dd>{modelStatus}</dd>
                    <dt>{t('requiredPrivilege', 'Required viewing privilege')}</dt>
                    <dd>{privilege || '—'}</dd>
                  </dl>
                </Tile>
                <Tile>
                  <h3>{t('quickLinks', 'Quick links')}</h3>
                  <Button kind="ghost" renderIcon={Code} onClick={() => setMode(1)}>
                    {t('viewJsonDefinition', 'View JSON definition')}
                  </Button>
                  <Button kind="ghost" renderIcon={View} onClick={() => setMode(2)}>
                    {t('previewWorkspace', 'Preview workspace')}
                  </Button>
                  <Button
                    kind="ghost"
                    renderIcon={CheckmarkOutline}
                    disabled={status !== 'idle'}
                    onClick={() => void validate()}>
                    {t('validateModel', 'Validate model')}
                  </Button>
                </Tile>
              </aside>
            </div>
          </TabPanel>
          <TabPanel>
            {mode === 1 && validationFailure && (
              <InlineNotification
                kind="error"
                hideCloseButton
                title={t('backendValidationErrors', 'Backend validation errors')}
                subtitle={validationFailure.message}
              />
            )}
            {mode === 1 && (
              <DefinitionJsonEditor
                value={jsonBuffer ?? definitionJson}
                errors={jsonErrors}
                onChange={editJson}
                onDiscard={() => setJsonBuffer(null)}
                disabled={status !== 'idle'}
              />
            )}
          </TabPanel>
          <TabPanel>{mode === 2 && <ModelPreview definition={definition} />}</TabPanel>
        </TabPanels>
      </Tabs>
      {leaveDialog && (
        <Modal
          open
          modalHeading={t('discardDesignerChanges', 'Leave the designer and discard unsaved changes?')}
          primaryButtonText={t('discardAndLeave', 'Discard and leave')}
          secondaryButtonText={t('keepEditing', 'Keep editing')}
          onRequestClose={() => setLeaveDialog(false)}
          onRequestSubmit={() => navigateToCareModelAdmin()}
          danger>
          <p>{t('unsavedDraftWarning', 'Unsaved model changes and the JSON editor buffer will be lost.')}</p>
        </Modal>
      )}
      {publishDialog && (
        <Modal
          open
          modalHeading={t('publishCareModel', 'Publish care model')}
          primaryButtonText={status === 'publishing' ? t('publishing', 'Publishing…') : t('publish', 'Publish')}
          secondaryButtonText={t('cancel', 'Cancel')}
          primaryButtonDisabled={
            status !== 'idle' || invalidJson || unresolvedValidation || !/^\d+\.\d+\.\d+$/.test(version)
          }
          onRequestClose={() => status === 'idle' && setPublishDialog(false)}
          onRequestSubmit={() => void publish()}
          preventCloseOnClickOutside>
          <Stack gap={5}>
            <p>
              {t(
                'publishExplanation',
                'The current edits will be validated, saved, then published using the new draft revision.',
              )}
            </p>
            <TextInput
              id="publish-version"
              labelText={t('releaseVersion', 'Release version')}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
            {message?.kind === 'error' && <InlineNotification kind="error" title={message.text} hideCloseButton />}
          </Stack>
        </Modal>
      )}
    </div>
  );
}
