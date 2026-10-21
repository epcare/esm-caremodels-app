import openmrs from '@openmrs/eslint-config';

export default [
  { ignores: ['**/dist/**', '**/*.d.ts', '.yarn/**'] },
  ...openmrs,
  {
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
