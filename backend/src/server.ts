/**
 * Local development entry point: a plain Express server.
 * Vercel uses index.ts instead, which exports the app rather than listening.
 */
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
