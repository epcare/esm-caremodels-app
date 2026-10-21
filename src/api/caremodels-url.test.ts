import { fetchRegistryModels, modelOperation } from './caremodels.resource';

// Exercise the installed framework's real URL prefixing; only the browser transport is mocked.
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  openmrsFetch: (await import('../../node_modules/@openmrs/esm-api/src/openmrs-fetch')).openmrsFetch,
}));
vi.mock('@openmrs/esm-config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getConfig: vi.fn(async () => ({ followRedirects: false, redirectAuthFailure: { enabled: false, errors: [] } })),
}));
vi.mock('@openmrs/esm-navigation', () => ({ navigate: vi.fn(), clearHistory: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  window.openmrsBase = '/openmrs';
});

it.each(['/openmrs', '/custom-installation', 'http://localhost:8087/openmrs'])(
  'prefixes registry requests exactly once with the installation base %s',
  async (base) => {
    window.openmrsBase = base;
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal('fetch', transport);
    await expect(fetchRegistryModels('')).resolves.toEqual([]);
    expect(transport).toHaveBeenCalledWith(
      `${base}/ws/rest/v1/caremodels/model?includeRetired=true&v=default&startIndex=0&limit=100`,
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
    expect(transport.mock.calls[0][0]).not.toContain('/openmrs/openmrs/');
  },
);

it('also prefixes operation POSTs exactly once', async () => {
  const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ valid: true }), { status: 200 }));
  vi.stubGlobal('fetch', transport);
  await expect(modelOperation({ operation: 'validate', definition: '{}' })).resolves.toMatchObject({ valid: true });
  expect(transport).toHaveBeenCalledWith(
    '/openmrs/ws/rest/v1/caremodels/modeloperation',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ operation: 'validate', definition: '{}' }) }),
  );
});
