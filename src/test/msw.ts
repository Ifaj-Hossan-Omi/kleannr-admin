import { setupServer } from 'msw/node';

/** Shared MSW server. Tests register per-case handlers via `server.use(...)`. */
export const server = setupServer();
