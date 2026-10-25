import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusMappingsEditor } from './status-mappings-editor.component';
import { blankDefinition } from '../model/definition';
import type { WidgetInstance } from '../../../types/caremodels';

it('uses exact bound coded answers and validates mapping labels before adding', () => {
  const definition = blankDefinition();
  definition.dataSources.state = { type: 'latest-observation', conceptAlias: 'concept', resultType: 'CODED' };
  definition.terminology.codedAnswers = { active: '11111111-1111-4111-8111-111111111111' };
  function Editor() {
    const [widget, setWidget] = useState<WidgetInstance>({
      id: 'status',
      type: 'metric',
      dataSource: 'state',
      properties: { presentation: 'status' },
    });
    return (
      <>
        <StatusMappingsEditor widget={widget} definition={definition} onChange={setWidget} />
        <output data-testid="widget">{JSON.stringify(widget)}</output>
      </>
    );
  }
  render(<Editor />);
  expect(screen.getByRole('button', { name: 'Add status mapping' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Registered coded-answer binding'), {
    target: { value: definition.terminology.codedAnswers.active },
  });
  fireEvent.change(screen.getByLabelText('Status label'), { target: { value: 'Configured active state' } });
  fireEvent.change(screen.getByLabelText('Tag color'), { target: { value: 'teal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add status mapping' }));
  expect(JSON.parse(screen.getByTestId('widget').textContent!).properties.statusMappings).toEqual([
    { value: definition.terminology.codedAnswers.active, label: 'Configured active state', tone: 'teal' },
  ]);
});
