import type { ModelDefinition } from '../types/caremodels';
export function mergeWorkspaceUpdate(
  base: ModelDefinition,
  update: ModelDefinition,
  options?: {
    verifiedForms: Array<{
      uuid: string;
      published: boolean;
      retired: boolean;
      encounterType?: { uuid: string } | null;
    }>;
  },
): ModelDefinition;
