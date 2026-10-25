import { restBaseUrl } from '@openmrs/esm-framework';

// Module identity. Must match the package name and the key used for
// this module in the deployed frontend config (config.json) and import map.
export const moduleName = '@epcare/esm-caremodels-app';

/** openmrsFetch prepends the OpenMRS installation base; keep this path REST-relative. */
export const careModelsBaseUrl = `${restBaseUrl}/caremodels`;

/** Master privilege guarding the whole Care Models feature; gates the patient summary and registry. */
export const masterPrivilege = 'View Care Models';

/** Manual enrollment: the membership-transition privilege that gates enrollment state changes. */
export const enrollmentPrivilege = 'Task: caremodels.member.transition';

/** Registry/designer access: create and edit care model drafts. */
export const manageModelPrivilege = 'Task: caremodels.model.manage';

/** Publish care model definitions from the designer. */
export const publishModelPrivilege = 'Task: caremodels.model.publish';
