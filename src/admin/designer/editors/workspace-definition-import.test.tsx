import React from 'react';
import { fetchForms } from '../../../api/caremodels.resource';
vi.mock('../../../api/caremodels.resource', async (original) => ({ ...(await original<object>()), fetchForms: vi.fn() }));
beforeEach(() => vi.mocked(fetchForms).mockResolvedValue([]));
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceDefinitionImport } from './workspace-definition-import.component';
import { hivUpdate as update } from '../../../configuration/hiv-workspace-update.fixture';
import type { ModelDefinition } from '../../../types/caremodels';
function fileOf(text: string) {
  const file = new File([text], 'hiv-workspace.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => text });
  return file;
}
it('stages a file for review then applies it without replacing the current enrollment policy or forms', async () => {
  const base = structuredClone(update) as ModelDefinition;
  base.enrollment = { enabled: true };
  const apply = vi.fn();
  render(<WorkspaceDefinitionImport definition={base} onApply={apply} disabled={false} />);
  fireEvent.change(screen.getByLabelText('Import workspace update JSON'), {
    target: { files: [fileOf(JSON.stringify(update))] },
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply workspace update' })).toBeEnabled());
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply workspace update' }));
  expect(apply.mock.calls[0][0].enrollment).toEqual(base.enrollment);
  expect(apply.mock.calls[0][0].forms).toEqual(base.forms);
});
it('rejects malformed JSON and unknown existing form associations without applying changes', async () => {
  const base = structuredClone(update) as ModelDefinition;
  base.forms = [];
  const apply = vi.fn();
  render(<WorkspaceDefinitionImport definition={base} onApply={apply} disabled={false} />);
  fireEvent.change(screen.getByLabelText('Import workspace update JSON'), { target: { files: [fileOf('{bad json')] } });
  await screen.findByText('Workspace update was not applied');
  expect(apply).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Import workspace update JSON'), {
    target: { files: [fileOf(JSON.stringify(update))] },
  });
  await screen.findByText(/must be verified as published and active/);
  expect(apply).not.toHaveBeenCalled();
});

it('associates exact catalog-verified forms without replacing existing form references', async () => {
  const base = structuredClone(update) as ModelDefinition;
  const original = base.forms.shift()!;
  vi.mocked(fetchForms).mockResolvedValue([
    {
      uuid: original.formUuid,
      name: 'Verified ART form',
      version: '1',
      published: true,
      retired: false,
      encounterType: { uuid: update.terminology.encounterTypes['hiv.artClinical'], name: 'ART' },
      resources: [],
    },
  ]);
  const apply = vi.fn();
  render(<WorkspaceDefinitionImport definition={base} onApply={apply} disabled={false} />);
  fireEvent.change(screen.getByLabelText('Import workspace update JSON'), {
    target: { files: [fileOf(JSON.stringify(update))] },
  });
  await screen.findByRole('button', { name: 'Apply workspace update' });
  fireEvent.click(screen.getByRole('button', { name: 'Apply workspace update' }));
  expect(apply.mock.calls[0][0].forms).toHaveLength(8);
  expect(apply.mock.calls[0][0].forms).toEqual(expect.arrayContaining(base.forms));
  expect(apply.mock.calls[0][0].forms).toContainEqual(original);
});
