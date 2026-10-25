import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { FormsEditor } from './configuration-editors.component';
import { blankDefinition } from '../model/definition';

const form = { name: 'Follow-up', encounterType: null, published: true, retired: false, resources: [] };
function Editor() {
  const [definition, setDefinition] = useState(blankDefinition());
  return (
    <>
      <FormsEditor definition={definition} onChange={setDefinition} />
      <output data-testid="definition">{JSON.stringify(definition)}</output>
    </>
  );
}

it('associates several forms at once with unique aliases and preserves all bindings', async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: {
      results: [
        { ...form, uuid: 'first', version: '1' },
        { ...form, uuid: 'second', version: '2' },
      ],
    },
  } as never);
  const user = userEvent.setup();
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Editor />
    </SWRConfig>,
  );
  const input = screen.getByRole('combobox', { name: /^Associated forms/ });
  await waitFor(() => expect(input).toBeEnabled());
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: /Follow-up — Version 1 — Published/ }));
  await user.click(await screen.findByRole('option', { name: /Follow-up — Version 2 — Published/ }));
  const aliases = screen.getAllByLabelText('Alias for Follow-up');
  expect(aliases).toHaveLength(2);
  fireEvent.change(aliases[1], { target: { value: 'follow-up' } });
  expect(screen.getByRole('button', { name: 'Add selected forms' })).toBeDisabled();
  fireEvent.change(aliases[1], { target: { value: 'follow-up-2' } });
  await user.click(screen.getByRole('button', { name: 'Add selected forms' }));
  const definition = JSON.parse(screen.getByTestId('definition').textContent!);
  expect(definition.forms).toEqual([
    { alias: 'follow-up', formUuid: 'first' },
    { alias: 'follow-up-2', formUuid: 'second' },
  ]);
  expect(definition.terminology.forms).toEqual({ 'follow-up': 'first', 'follow-up-2': 'second' });
  expect(screen.getByRole('button', { name: 'Add selected forms' })).toBeDisabled();
  expect(screen.getByText('2 of 50 forms associated')).toBeInTheDocument();
});
