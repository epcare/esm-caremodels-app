import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { ConceptSelector } from './concept-selector.component';

it('debounces real concept search and retains the selected metadata and exact UUID', async () => {
  const concept = {
    uuid: 'exact-concept-uuid',
    display: 'Blood pressure',
    datatype: { display: 'Numeric' },
    conceptClass: { display: 'Finding' },
    units: 'mmHg',
    mappings: [{ display: 'Source:123' }],
  };
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { results: [concept] } } as never);
  const onSelect = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ConceptSelector onSelect={onSelect} />
    </SWRConfig>,
  );
  const input = screen.getByRole('combobox', { name: 'Search OpenMRS concepts' });
  fireEvent.change(input, { target: { value: 'b' } });
  expect(openmrsFetch).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'blood' } });
  const option = await screen.findByRole('option', { name: /Blood pressure/ });
  expect(screen.getByText('exact-concept-uuid')).toBeInTheDocument();
  expect(screen.getByText('Numeric · Finding · mmHg')).toBeInTheDocument();
  fireEvent.click(option);
  expect(onSelect).toHaveBeenCalledWith(concept);
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/concept?q=blood&v=custom:')));
});
