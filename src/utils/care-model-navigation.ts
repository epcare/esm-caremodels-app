import { interpolateUrl, navigate } from '@openmrs/esm-framework';

/** OpenMRS shell owns routing; these components are not mounted under React Router. */
export function careModelAdminUrl(modelCode?: string) {
  const path = modelCode ? `/care-models-admin/${encodeURIComponent(modelCode)}` : '/care-models-admin';
  return interpolateUrl(`\${openmrsSpaBase}${path}`);
}

export function navigateToCareModelAdmin(modelCode?: string, options?: { replace?: boolean }) {
  navigate({ to: careModelAdminUrl(modelCode), ...options });
}

/** The designer route is care-models-admin/:modelCode, with `new` for creation. */
export function getModelCodeFromLocation(): string | null {
  const match = window.location.pathname.match(/\/care-models-admin\/([^/]+)\/?$/);
  if (!match) return null;
  let code: string;
  try {
    code = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return code && code !== 'new' ? code : null;
}
