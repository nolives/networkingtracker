/**
 * Vercel serverless entry point.
 *
 * The Express app itself lives in backend/ -- this file only adapts it to
 * Vercel's function signature, keeping the backend framework-agnostic and
 * runnable on its own (npm run dev:backend) with no Vercel involvement.
 */
import { loadEnv } from '../backend/src/env.js';

loadEnv();

const { createApp } = await import('../backend/src/app.js');

export default createApp();
