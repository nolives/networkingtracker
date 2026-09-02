/**
 * Serverless entry point (Vercel).
 *
 * Vercel's Express integration expects the entrypoint to default-export the
 * app and manages listening itself. `server.ts` is the standalone counterpart
 * used locally, so the backend still runs as an ordinary Express server with
 * no Vercel involvement.
 */
import { createApp } from './app.js';

export default createApp();
