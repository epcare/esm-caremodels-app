import React, { useEffect, useState } from 'react';
import { Button, ComboBox, InlineLoading, InlineNotification, Stack } from '@carbon/react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { searchConcepts, type OpenmrsConcept } from '../api/caremodels.resource';

export function ConceptSelector({ onSelect }: { onSelect: (concept: OpenmrsConcept) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);
  const { data, error, isLoading, mutate } = useSWR(
    query.length >= 2 ? ['caremodels-concepts', query] : null,
    ([, q]) => searchConcepts(q),
    { shouldRetryOnError: false },
  );
  return (
    <Stack gap={3}>
      <ComboBox<OpenmrsConcept>
        id="observation-concept"
        titleText={t('searchObservationConcept', 'Search OpenMRS concepts')}
        items={data ?? []}
        itemToString={(item) => item?.display ?? ''}
        onInputChange={setInput}
        onChange={({ selectedItem }) => selectedItem && onSelect(selectedItem)}
        itemToElement={(item) => (
          <div>
            <strong>
              {item.display}
              {(item.set || item.datatype?.display?.toLowerCase() === 'n/a') && (
                <span> · {item.set ? 'Concept set' : 'N/A datatype'}</span>
              )}
            </strong>
            <p>{item.uuid}</p>
            <p>{[item.datatype?.display, item.conceptClass?.display, item.units].filter(Boolean).join(' · ')}</p>
          </div>
        )}
        helperText={t(
          'conceptSearchHint',
          'Type at least two characters. Select the exact concept and review its UUID and datatype.',
        )}
      />
      {isLoading && <InlineLoading description={t('searchingConcepts', 'Searching concepts…')} />}
      {error && (
        <>
          <InlineNotification kind="error" hideCloseButton title={t('conceptSearchFailed', 'Concept search failed')} />
          <Button kind="tertiary" onClick={() => void mutate()}>
            {t('retryConceptSearch', 'Retry concept search')}
          </Button>
        </>
      )}
    </Stack>
  );
}
