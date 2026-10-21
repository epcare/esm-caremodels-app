import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  maxInnerTabs: {
    _type: Type.Number,
    _default: 10,
    _description: 'Maximum number of inner tabs rendered per care model; mirrors the backend schema bound.',
  },
};

export type CareModelsConfig = typeof configSchema;
