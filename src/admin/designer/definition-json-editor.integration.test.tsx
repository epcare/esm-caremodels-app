import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DefinitionJsonEditor } from './definition-json-editor.component';

it('loads the installed Ace JSON editor and exposes the editing toolbar', async () => {
  const { unmount } = render(
    <DefinitionJsonEditor
      value='{"example":1}'
      errors={[]}
      onChange={() => {}}
      onDiscard={() => {}}
      disabled={false}
    />,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Format JSON' })).toBeEnabled(), { timeout: 10000 });
  expect(screen.getByRole('textbox', { name: 'Definition JSON' })).toBeInTheDocument();
  unmount();
});
