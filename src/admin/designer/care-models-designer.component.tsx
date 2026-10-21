import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  TextArea,
  TextInput,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
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
import { getModelCodeFromLocation, navigateToCareModelAdmin } from '../../utils/care-model-navigation';
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
import styles from './designer.scss';

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
  const [preview, setPreview] = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);
  const [baseline, setBaseline] = useState('');
  const [reload, setReload] = useState(0);
  const operationInProgress = useRef(false);
  const metadata = { name, description, privilege };
  const serialized = JSON.stringify({ definition, ...metadata });
  const dirty = baseline !== serialized;

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
      const result = await validateDefinition(definition);
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
      const validation = await validateDefinition(definition);
      if (!validation.valid)
        throw new Error(validation.validationErrors ?? t('validationFailed', 'Definition is invalid'));
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
      <div className={styles.designerHeader}>
        <Button
          kind="ghost"
          hasIconOnly
          iconDescription={t('back', 'Back')}
          renderIcon={ArrowLeft}
          onClick={() => navigateToCareModelAdmin()}
        />
        <div>
          <h2>{name || code || t('newCareModel', 'New Care Model')}</h2>
          <Tag type="blue">{modelStatus}</Tag>
          <Tag type="gray">{t('revisionNumber', 'Revision {{revision}}', { revision })}</Tag>
          {dirty && <Tag type="warm-gray">{t('unsavedChanges', 'Unsaved changes')}</Tag>}
        </div>
        <span className={styles.headerSpacer} />
        <Button kind="tertiary" onClick={() => setPreview(true)}>
          {t('preview', 'Preview')}
        </Button>
        <Button kind="secondary" onClick={() => void validate()} disabled={status !== 'idle'}>
          {t('validate', 'Validate')}
        </Button>
        <Button onClick={() => void save()} disabled={status !== 'idle'}>
          {status === 'saving' ? t('saving', 'Saving…') : t('saveDraft', 'Save draft')}
        </Button>
        <UserHasAccess privilege="Task: caremodels.model.publish">
          <Button
            onClick={() => setPublishDialog(true)}
            disabled={status !== 'idle' || !modelCode || modelStatus === 'RETIRED'}>
            {t('publish', 'Publish')}
          </Button>
        </UserHasAccess>
      </div>
      {message && (
        <InlineNotification
          kind={message.kind}
          title={message.kind === 'error' ? t('problem', 'Problem') : t('success', 'Success')}
          subtitle={message.text}
          onCloseButtonClick={() => setMessage(null)}
        />
      )}
      <ol className={styles.stepNav}>
        {steps.map((candidate, index) => (
          <li key={candidate}>
            <Button
              kind={candidate === step ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setStep(candidate)}
              aria-current={candidate === step ? 'step' : undefined}>
              {index + 1}. {t(`step.${candidate}`, candidate)}
            </Button>
          </li>
        ))}
      </ol>
      <div className={styles.stepBody}>
        {step === 'general' && (
          <Stack gap={5}>
            <TextInput
              id="designer-code"
              labelText={t('modelCode', 'Code')}
              value={code}
              disabled={Boolean(modelCode)}
              onChange={(e) => setCode(e.target.value)}
            />
            <TextInput
              id="designer-name"
              labelText={t('modelName', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextInput
              id="designer-display-label"
              labelText={t('patientDisplayLabel', 'Patient display label')}
              value={definition.metadata.display.label}
              onChange={(e) =>
                setDefinition({
                  ...definition,
                  metadata: {
                    ...definition.metadata,
                    display: { ...definition.metadata.display, label: e.target.value },
                  },
                })
              }
            />
            <TextArea
              id="designer-description"
              labelText={t('description', 'Description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Select
              id="designer-category"
              labelText={t('category', 'Category')}
              value={definition.metadata.category}
              onChange={(e) =>
                setDefinition({
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
            <TextInput
              id="release-version"
              labelText={t('releaseVersion', 'Release version')}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              helperText={t('publishedVersion', 'Published: {{version}}', {
                version: publishedVersion ?? t('none', 'None'),
              })}
            />
          </Stack>
        )}
        {step === 'enrollmentRules' && <EnrollmentEditor definition={definition} onChange={setDefinition} />}
        {step === 'workspace' && <WorkspaceEditor definition={definition} onChange={setDefinition} />}
        {step === 'dataSources' && <DataSourcesEditor definition={definition} onChange={setDefinition} />}
        {step === 'forms' && <FormsEditor definition={definition} onChange={setDefinition} />}
        {step === 'actions' && <ActionsEditor definition={definition} onChange={setDefinition} />}
        {step === 'carePathway' && <PathwayEditor definition={definition} onChange={setDefinition} />}
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
      </div>
      <div className={styles.wizardFooter}>
        <Button kind="ghost" disabled={currentIndex === 0} onClick={() => setStep(steps[currentIndex - 1])}>
          {t('back', 'Back')}
        </Button>
        <span className={styles.headerSpacer} />
        <Button disabled={currentIndex === steps.length - 1} onClick={() => setStep(steps[currentIndex + 1])}>
          {t('next', 'Next')}
        </Button>
      </div>
      <Modal
        open={preview}
        passiveModal
        size="lg"
        modalHeading={t('workspacePreview', 'Workspace preview')}
        onRequestClose={() => setPreview(false)}>
        {preview && <WorkspaceEditor definition={definition} onChange={() => {}} preview />}
      </Modal>
      <Modal
        open={publishDialog}
        modalHeading={t('publishCareModel', 'Publish care model')}
        primaryButtonText={status === 'publishing' ? t('publishing', 'Publishing…') : t('publish', 'Publish')}
        secondaryButtonText={t('cancel', 'Cancel')}
        primaryButtonDisabled={status !== 'idle' || !/^\d+\.\d+\.\d+$/.test(version)}
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
    </div>
  );
}
