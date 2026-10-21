import React from 'react';
import { render, screen } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { widgetManifest } from './widget-registry';
import { WidgetPreview } from '../admin/designer/widget-preview.component';
vi.mock('@carbon/charts', () => ({
  LineChart: class {
    destroy() {}
  },
  SimpleBarChart: class {
    destroy() {}
  },
  ScaleTypes: { TIME: 'time', LINEAR: 'linear', LOG: 'log' },
}));
it.each(widgetManifest)('renders the shared $id preview with no backend requests', (manifest) => {
  render(
    <WidgetPreview
      tabId="overview"
      widget={{
        id: 'test',
        type: manifest.type,
        properties: {
          ...manifest.properties,
          ...(manifest.configurable.includes('title') ? { title: manifest.label } : {}),
        },
      }}
    />,
  );
  expect(screen.getByText('Preview data')).toBeInTheDocument();
  if (manifest.configurable.includes('title')) expect(screen.getAllByText(manifest.label).length).toBeGreaterThan(0);
  expect(screen.queryByText('Invalid configuration')).not.toBeInTheDocument();
  expect(openmrsFetch).not.toHaveBeenCalled();
});
