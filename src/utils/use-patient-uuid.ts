import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('single-spa:routing-event', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('single-spa:routing-event', onChange);
    window.removeEventListener('popstate', onChange);
  };
}
function getPatientUuid() {
  return window.location.pathname.match(/\/patient\/([a-zA-Z0-9-]+)(?:\/|$)/)?.[1] ?? null;
}
/** Same routing event as framework usePatient, without fetching a second patient record. */
export function usePatientUuid(providedUuid?: string) {
  const routeUuid = useSyncExternalStore(subscribe, getPatientUuid);
  return providedUuid ?? routeUuid;
}
