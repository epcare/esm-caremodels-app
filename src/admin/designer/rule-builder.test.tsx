import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RuleBuilder } from './rule-builder.component';
import type { RuleNode } from '../../types/caremodels';

function Editor({ initial }: { initial: RuleNode }) {
  const [node, setNode] = useState(initial);
  return (
    <>
      <RuleBuilder node={node} onChange={setNode} />
      <output data-testid="json">{JSON.stringify(node)}</output>
    </>
  );
}
it('switches ALL to ANY and wraps/unpacks NOT without losing the condition', () => {
  const predicate = { type: 'program' as const, operator: 'EXISTS', alias: 'program' };
  render(<Editor initial={{ all: [predicate] }} />);
  fireEvent.change(screen.getByLabelText('Group operator'), { target: { value: 'any' } });
  expect(screen.getByTestId('json')).toHaveTextContent(JSON.stringify({ any: [predicate] }));
  fireEvent.change(screen.getByLabelText('Group operator'), { target: { value: 'not' } });
  expect(screen.getByTestId('json')).toHaveTextContent(JSON.stringify({ not: predicate }));
});
it('preserves numeric-looking strings until an explicit value type change', () => {
  render(<Editor initial={{ type: 'observation', operator: 'EQUALS', alias: 'concept', value: '001' }} />);
  fireEvent.change(screen.getByLabelText('Value'), { target: { value: '002' } });
  expect(screen.getByTestId('json')).toHaveTextContent('"value":"002"');
  fireEvent.change(screen.getByLabelText('Value type'), { target: { value: 'boolean' } });
  expect(screen.getByTestId('json')).toHaveTextContent('"value":false');
});
