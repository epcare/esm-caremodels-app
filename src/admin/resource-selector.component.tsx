import React, { useState } from 'react';
import { ComboBox, FilterableMultiSelect, InlineNotification } from '@carbon/react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { fetchForms, searchOpenmrsResources, type OpenmrsChoice, type OpenmrsForm } from '../api/caremodels.resource';

function SearchResourceSelector({
  resource,
  label,
  onSelect,
}: {
  resource: 'concept' | 'program' | 'encountertype' | 'form';
  label: string;
  onSelect: (choice: OpenmrsChoice) => void;
}) {
  const [query, setQuery] = useState('');
  const { t } = useTranslation();
  const { data, error } = useSWR(
    query.trim().length >= 2 ? ['caremodels-resource', resource, query.trim()] : null,
    ([, type, q]) => searchOpenmrsResources(type as typeof resource, q),
  );
  return (
    <>
      <ComboBox<OpenmrsChoice>
        id={`resource-${resource}`}
        titleText={label}
        items={data ?? []}
        itemToString={(item) => item?.display ?? ''}
        onInputChange={(input) => setQuery(input)}
        onChange={({ selectedItem }) => selectedItem && onSelect(selectedItem)}
        helperText={t('resourceSearchHint', 'Type at least two characters to search existing OpenMRS resources.')}
      />
      {error && (
        <InlineNotification kind="error" title={t('resourceSearchError', 'Resource search failed')} hideCloseButton />
      )}
    </>
  );
}

export function ResourceSelector(props: {
  resource: 'concept' | 'program' | 'encountertype' | 'form';
  label: string;
  onSelect: (choice: OpenmrsChoice) => void;
}) {
  return props.resource === 'form' ? (
    <FormSelector label={props.label} onSelect={props.onSelect} />
  ) : (
    <SearchResourceSelector {...props} />
  );
}

function FormSelector({ label, onSelect }: { label: string; onSelect: (choice: OpenmrsChoice) => void }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR('caremodels-form-catalog', fetchForms, { shouldRetryOnError: false });
  const choices = (data ?? []).map((form) => ({ ...form, display: form.name }));
  const description = (form: OpenmrsForm) =>
    [
      form.name,
      t('formVersion', 'Version {{version}}', { version: form.version }),
      form.encounterType?.name,
      form.published ? t('formPublished', 'Published') : t('formDraft', 'Draft'),
      form.retired ? t('formRetired', 'Retired') : null,
    ]
      .filter(Boolean)
      .join(' — ');
  return (
    <>
      <ComboBox<OpenmrsForm & OpenmrsChoice>
        id="resource-form"
        titleText={label}
        items={choices}
        disabled={isLoading || Boolean(error)}
        itemToString={(item) => (item ? description(item) : '')}
        shouldFilterItem={({ item, inputValue }) =>
          description(item)
            .toLowerCase()
            .includes((inputValue ?? '').toLowerCase())
        }
        onChange={({ selectedItem }) => selectedItem && onSelect(selectedItem)}
        helperText={
          isLoading
            ? t('loadingForms', 'Loading forms…')
            : !error && !choices.length
              ? t('noFormsAvailable', 'No OpenMRS forms are available.')
              : t('formCatalogHint', 'Search forms by name, version, encounter type or status.')
        }
      />
      {error && (
        <InlineNotification kind="error" title={t('formsLoadError', 'Could not load OpenMRS forms')} hideCloseButton />
      )}
    </>
  );
}

export function FormMultiSelector({
  selected,
  excludedUuids,
  onChange,
}: {
  selected: Array<OpenmrsForm>;
  excludedUuids: Array<string>;
  onChange: (forms: Array<OpenmrsForm>) => void;
}) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR('caremodels-form-catalog', fetchForms, { shouldRetryOnError: false });
  const describe = (form: OpenmrsForm | null) =>
    form
      ? [
          form.name,
          t('formVersion', 'Version {{version}}', { version: form.version }),
          form.encounterType?.name,
          form.published ? t('formPublished', 'Published') : t('formDraft', 'Draft'),
          form.retired ? t('formRetired', 'Retired') : null,
        ]
          .filter(Boolean)
          .join(' — ')
      : '';
  return (
    <>
      <FilterableMultiSelect<OpenmrsForm>
        id="associated-form-picker"
        titleText={t('associatedForms', 'Associated forms')}
        placeholder={t('selectAssociatedForms', 'Select one or more forms')}
        items={(data ?? []).filter((form) => !excludedUuids.includes(form.uuid))}
        selectedItems={selected}
        itemToString={describe}
        disabled={isLoading || Boolean(error)}
        onChange={({ selectedItems }) => onChange(selectedItems ?? [])}
        helperText={
          isLoading
            ? t('loadingForms', 'Loading forms…')
            : !error && !data?.length
              ? t('noFormsAvailable', 'No OpenMRS forms are available.')
              : t('multipleFormsHint', 'Select forms, review their aliases, then add them to this care model.')
        }
      />
      {error && (
        <InlineNotification kind="error" title={t('formsLoadError', 'Could not load OpenMRS forms')} hideCloseButton />
      )}
    </>
  );
}
