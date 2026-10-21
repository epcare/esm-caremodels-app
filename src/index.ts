import { createDashboard, defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import CareModelsAdminCardLink from './admin/care-models-admin-card-link.component';
import { dashboardMeta } from './dashboard.meta';
import { configSchema } from './config-schema';

const moduleName = '@epcare/esm-caremodels-app';

const options = {
  featureName: 'Care Models',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

// t('careModels', 'Care Models') — left-nav chart dashboard entry on the patient page
export const careModelsSummaryDashboardLink = getSyncLifecycle(createDashboard(dashboardMeta), options);

// the summary space on the patient chart: enrolled-only outer tabs + inner-tab workspace
export const careModelsPatientSummary = getAsyncLifecycle(
  () => import('./patient-summary/care-models-summary.component'),
  options,
);

// admin registry page at /care-models-admin
export const careModelsAdminHome = getAsyncLifecycle(() => import('./admin/care-models-admin-home.component'), options);

// System Administration card linking to the registry/designer; gated on the manage privilege
// via the extension's "privileges" registration
export const careModelsAdminCardLink = getSyncLifecycle(CareModelsAdminCardLink, options);

// designer wizard at /care-models-admin/:modelCode (new | existing code)
export const careModelsDesigner = getAsyncLifecycle(
  () => import('./admin/designer/care-models-designer.component'),
  options,
);
