import { setGlobalOptions } from 'firebase-functions/v2';

/** CLAUDE.md: Cloud Functions em southamerica-east1. */
setGlobalOptions({
  region: 'southamerica-east1',
  maxInstances: 10,
});

export { ensureUserBootstrap } from './callables/ensure-user-bootstrap';
export { setUserRole } from './callables/set-user-role';

// Proximas: createBooking (F5, transacional e atomico), grants automaticos e
// expiracao FIFO da carteira (F5), token da sala Daily (F8).
