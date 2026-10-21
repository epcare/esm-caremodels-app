import { type DashboardExtensionProps } from '@openmrs/esm-framework';

export const dashboardMeta: Omit<DashboardExtensionProps, 'basePath'> & {
  slot: string;
  columns: number;
  hideDashboardTitle: boolean;
} = {
  slot: 'patient-chart-caremodels-dashboard-slot',
  columns: 1,
  title: 'careModels',
  hideDashboardTitle: true,
  path: 'care-models',
  icon: 'omrs-icon-group',
};
