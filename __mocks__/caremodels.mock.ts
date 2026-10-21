import { mockSession } from './session.mock';

export const mockMembership = {
  memberUuid: 'member-uuid-1',
  modelUuid: 'model-uuid-hiv',
  modelCode: 'HIV_CARE',
  modelName: 'HIV Care',
  displayLabel: 'HIV Care',
  episodeNumber: 1,
  dateEnrolled: '2026-10-01T08:00:00.000+0000',
};

export const mockMemberships = [mockMembership];

export const mockWorkspaceTab = {
  modelCode: 'HIV_CARE',
  modelUuid: 'model-uuid-hiv',
  memberUuid: 'member-uuid-1',
  tabId: 'overview',
  tabLabel: 'Overview',
  widgets: [
    {
      id: 'art-status-metric',
      type: 'metric',
      dataSource: 'art_status_latest',
      position: { row: 0, col: 1, w: 3, h: 2 },
      properties: { title: 'ART status' },
    },
  ],
  tabs: [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
  ],
};

export const mockSessionWithMasterPrivilege = mockSession(['View Care Models', 'View Patients', 'Get Patients']);
export const mockSessionWithoutMasterPrivilege = mockSession(['View Patients', 'Get Patients']);
