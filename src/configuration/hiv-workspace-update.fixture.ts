import type { ModelDefinition } from '../types/caremodels';

/**
 * Test fixture shaped like the HIV workspace update that content packages now deploy.
 * Values are synthetic and self-consistent; no implementation-specific OpenMRS UUIDs.
 */
export const hivUpdate: ModelDefinition = {
  schemaVersion: '1.0.0',
  metadata: { category: 'CHRONIC_CARE', display: { label: 'HIV Care and Treatment', order: 10 } },
  terminology: {
    concepts: {
      'hiv.artStartDate': '00000000-0000-4000-8000-000000000001',
      'hiv.latestViralLoad': '00000000-0000-4000-8000-000000000002',
      'hiv.latestCd4': '00000000-0000-4000-8000-000000000003',
      'hiv.tbStatus': '00000000-0000-4000-8000-000000000004',
    },
    encounterTypes: {
      'hiv.artClinical': '00000000-0000-4000-8000-000000000005',
      'hiv.artSummary': '00000000-0000-4000-8000-000000000006',
      'hiv.healthEducation': '00000000-0000-4000-8000-000000000007',
      'hiv.regimenChange': '00000000-0000-4000-8000-000000000008',
      'hiv.viralLoadRequest': '00000000-0000-4000-8000-000000000009',
      'hiv.transferIn': '00000000-0000-4000-8000-000000000010',
      'hiv.transferOut': '00000000-0000-4000-8000-000000000011',
      'hiv.familyTracking': '00000000-0000-4000-8000-000000000012',
    },
    forms: {
      'hiv.artClinical': '00000000-0000-4000-8000-000000000013',
      'hiv.artSummary': '00000000-0000-4000-8000-000000000014',
      'hiv.healthEducation': '00000000-0000-4000-8000-000000000015',
      'hiv.regimenChange': '00000000-0000-4000-8000-000000000016',
      'hiv.viralLoadRequest': '00000000-0000-4000-8000-000000000017',
      'hiv.transferIn': '00000000-0000-4000-8000-000000000018',
      'hiv.transferOut': '00000000-0000-4000-8000-000000000019',
      'hiv.familyTracking': '00000000-0000-4000-8000-000000000020',
    },
  },
  enrollment: { enabled: false, triggers: [], rules: [] },
  dataSources: {
    latestViralLoad: {
      type: 'latest-observation',
      conceptAlias: 'hiv.latestViralLoad',
      resultType: 'NUMBER',
      maxResults: 1,
      includeVoided: false,
    },
    artStartDate: {
      type: 'latest-observation',
      conceptAlias: 'hiv.artStartDate',
      resultType: 'DATE',
      maxResults: 1,
      includeVoided: false,
    },
  },
  workspace: {
    defaultTab: 'overview',
    tabs: [
      'overview',
      'art-regimens',
      'viral-load-iac',
      'clinical-assessment',
      'dsdm-psychosocial',
      'clinical-history',
      'forms-actions',
      'care-plan',
    ].map((id) => ({ id, label: id, widgets: [] })),
  },
  forms: (
    [
      ['hiv.artClinical', '00000000-0000-4000-8000-000000000013'],
      ['hiv.artSummary', '00000000-0000-4000-8000-000000000014'],
      ['hiv.healthEducation', '00000000-0000-4000-8000-000000000015'],
      ['hiv.regimenChange', '00000000-0000-4000-8000-000000000016'],
      ['hiv.viralLoadRequest', '00000000-0000-4000-8000-000000000017'],
      ['hiv.transferIn', '00000000-0000-4000-8000-000000000018'],
      ['hiv.transferOut', '00000000-0000-4000-8000-000000000019'],
      ['hiv.familyTracking', '00000000-0000-4000-8000-000000000020'],
    ] as const
  ).map(([alias, formUuid]) => ({
    alias,
    formUuid,
    encounterTypeAlias: alias,
  })),
  actions: [
    { id: 'hiv.recordArtVisit', type: 'launch-form', label: 'Record ART visit', formAlias: 'hiv.artClinical' },
    { id: 'hiv.requestViralLoad', type: 'launch-form', label: 'Request viral load', formAlias: 'hiv.viralLoadRequest' },
    { id: 'hiv.changeRegimen', type: 'launch-form', label: 'Change regimen', formAlias: 'hiv.regimenChange' },
  ],
  pathways: { enabled: false, stages: [], transitions: [] },
  automation: { rules: [] },
  lifecycle: { completion: { mode: 'MANUAL' }, onSourceCorrection: 'FLAG_FOR_REVIEW' },
};
