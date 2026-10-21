import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { ResourceSelector } from './resource-selector.component';
import { fetchForms, formRepresentation } from '../api/caremodels.resource';

const form = {
  uuid: 'form-uuid',
  name: 'Follow-up',
  version: '2.1',
  encounterType: { uuid: 'encounter-uuid', name: 'Consultation' },
  published: true,
  retired: false,
  resources: [
    { uuid: 'resource-uuid', name: 'JSON schema', dataType: 'AmpathJsonSchema', valueReference: 'schema-reference' },
  ],
};
const fetch = vi.mocked(openmrsFetch);
it('uses the supplied custom representation and preserves all form resources across pages', async () => {
  fetch.mockResolvedValueOnce({
    data: { results: [form], links: [{ rel: 'next', uri: '/openmrs/ws/rest/v1/form?startIndex=50' }] },
  } as never);
  fetch.mockResolvedValueOnce({
    data: { results: [{ ...form, uuid: 'retired', retired: true, published: false }] },
  } as never);
  const forms = await fetchForms();
  expect(fetch.mock.calls[0][0]).toBe(`${restBaseUrl}/form?v=${formRepresentation}&includeAll=true`);
  expect(fetch.mock.calls[1][0]).toBe(`${restBaseUrl}/form?v=${formRepresentation}&includeAll=true&startIndex=50`);
  expect(forms).toHaveLength(2);
  expect(forms[0].resources).toEqual(form.resources);
  expect(forms[1].retired).toBe(true);
});

it('lists forms immediately and selects their real UUID with version and encounter details', async () => {
  fetch.mockResolvedValue({ data: { results: [form] } } as never);
  const onSelect = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ResourceSelector resource="form" label="Choose a form" onSelect={onSelect} />
    </SWRConfig>,
  );
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Choose a form' })).toBeEnabled());
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a form' }), { target: { value: 'Follow' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Follow-up — Version 2.1 — Consultation — Published' }));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({
      uuid: 'form-uuid',
      name: 'Follow-up',
      encounterType: form.encounterType,
      resources: form.resources,
    }),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
