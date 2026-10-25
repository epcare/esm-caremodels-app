import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { hivUpdate as update } from '../../../configuration/hiv-workspace-update.fixture';
import type { ModelDefinition } from '../../../types/caremodels';
import { EnrollmentEditor } from './configuration-editors.component';

it('writes a declared typed encounter alias rather than a UUID in the generic alias field', () => {
  const definition = structuredClone(update) as ModelDefinition;
  definition.enrollment = {
    enabled: true,
    triggers: [{ type: 'ENCOUNTER_SAVED', alias: update.terminology.encounterTypes!['hiv.artSummary'] }],
  };
  const onChange = vi.fn();

  render(<EnrollmentEditor definition={definition} onChange={onChange} />);
  expect(screen.getByLabelText('Encounter type alias')).toHaveValue('hiv.artSummary');
  fireEvent.click(screen.getByRole('button', { name: 'Repair legacy trigger alias' }));

  const next = onChange.mock.calls.at(-1)![0] as ModelDefinition;
  expect(next.enrollment.triggers).toEqual([
    { type: 'ENCOUNTER_SAVED', encounterTypeAlias: 'hiv.artSummary' },
  ]);
});
