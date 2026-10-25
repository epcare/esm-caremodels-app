import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DefinitionJsonEditor } from './definition-json-editor.component';

const ace = vi.hoisted(() => {
  let text = '';
  let change = () => {};
  const instance = {
    session: {
      setUseWorker: vi.fn(),
      setMode: vi.fn(),
      setAnnotations: vi.fn(),
      on: vi.fn((_event, listener) => {
        change = listener;
      }),
    },
    setOptions: vi.fn(),
    setReadOnly: vi.fn(),
    destroy: vi.fn(),
    execCommand: vi.fn(),
    getValue: () => text,
    setValue: vi.fn((value) => {
      text = value;
      change();
    }),
    textInput: { getElement: () => ({ setAttribute: vi.fn() }) },
  };
  return {
    instance,
    edit: vi.fn(() => instance),
    type: (value) => {
      text = value;
      change();
    },
  };
});
vi.mock('ace-builds/src-noconflict/ace', () => ({ edit: ace.edit }));
vi.mock('ace-builds/src-noconflict/mode-json', () => ({}));
vi.mock('ace-builds/src-noconflict/ext-searchbox', () => ({}));

it('loads JSON mode without a worker and synchronizes external values without emitting edits', async () => {
  const onChange = vi.fn();
  const { rerender, unmount } = render(
    <DefinitionJsonEditor value='{"a":1}' errors={[]} onChange={onChange} onDiscard={() => {}} disabled={false} />,
  );
  await waitFor(() => expect(ace.instance.session.setMode).toHaveBeenCalledWith('ace/mode/json'));
  expect(ace.instance.session.setUseWorker).toHaveBeenCalledWith(false);
  onChange.mockClear();
  rerender(
    <DefinitionJsonEditor value='{"a":2}' errors={[]} onChange={onChange} onDiscard={() => {}} disabled={false} />,
  );
  expect(ace.instance.getValue()).toBe('{"a":2}');
  expect(onChange).not.toHaveBeenCalled();
  act(() => ace.type('{broken'));
  expect(onChange).toHaveBeenCalledWith('{broken');
  unmount();
  expect(ace.instance.destroy).toHaveBeenCalled();
});
it('provides formatting, search, folding and error annotations', async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <DefinitionJsonEditor value='{"a":1}' errors={[]} onChange={onChange} onDiscard={() => {}} disabled={false} />,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Format JSON' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Format JSON' }));
  expect(onChange).toHaveBeenCalledWith('{\n  "a": 1\n}');
  fireEvent.click(screen.getByRole('button', { name: 'Search JSON' }));
  expect(ace.instance.execCommand).toHaveBeenCalledWith('find');
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
  expect(ace.instance.execCommand).toHaveBeenCalledWith('foldall');
  rerender(
    <DefinitionJsonEditor
      value="{}"
      errors={['/metadata (line 2, column 3): is required']}
      onChange={onChange}
      onDiscard={() => {}}
      disabled={false}
    />,
  );
  expect(screen.getByRole('button', { name: 'Format JSON' })).toBeDisabled();
  expect(ace.instance.session.setAnnotations).toHaveBeenLastCalledWith([
    expect.objectContaining({ row: 1, column: 2, type: 'error' }),
  ]);
});
