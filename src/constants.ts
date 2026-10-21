import { restBaseUrl } from '@openmrs/esm-framework';

// ePCare module identity. Must match the package name and the key used for
// this module in the deployed frontend config (config.json) and import map.
export const moduleName = '@epcare/esm-caremodels-app';

/** openmrsFetch prepends the OpenMRS installation base; keep this path REST-relative. */
export const careModelsBaseUrl = `${restBaseUrl}/caremodels`;

/** Master privilege guarding the whole Care Models feature. */
export const masterPrivilege = 'View Care Models';
