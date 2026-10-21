// ePCare module identity. Must match the package name and the key used for
// this module in the deployed frontend config (config.json) and import map.
export const moduleName = '@epcare/esm-caremodels-app';

/** Backend REST base served by openmrs-module-caremodels (RESTWS resources). */
export const careModelsBaseUrl = `${window.openmrsBase ?? '/openmrs'}/ws/rest/v1/caremodels`;

/** Master privilege guarding the whole Care Models feature. */
export const masterPrivilege = 'View Care Models';
