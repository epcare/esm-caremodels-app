import type { Session } from '@openmrs/esm-framework';

export const mockSession = (privileges: Array<string>): Session =>
  ({
    authenticated: true,
    user: {
      uuid: 'user-uuid-1',
      display: 'admin',
      person: { uuid: 'person-uuid-1', display: 'Test Admin' },
      privileges: privileges.map((name, index) => ({ uuid: `priv-${index}`, name, description: name })),
      roles: [],
    },
    sessionLocation: { uuid: 'location-uuid-1', display: 'Unknown Location' },
    // cast: the frontend only reads the slice declared in CareModelsSession
  }) as unknown as Session;
