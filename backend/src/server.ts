/**
 * Local development entry point. Vercel uses api/index.ts instead.
 *
 * Env vars are loaded before app.ts is imported, because auth.ts and
 * dataApi.ts validate their configuration at module load.
 */
import { loadEnv } from './env.js';

loadEnv();

const { createApp } = await import('./app.js');

const port = Number(process.env.PORT ?? 3001);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
