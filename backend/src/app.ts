import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { DataApiError } from './dataApi.js';
import { contactsRouter, mapDataApiError } from './routes/contacts.js';

export function createApp() {
  const app = express();

  // Vercel terminates TLS upstream; trust it so req.ip and protocol are right.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  /**
   * In the deployed single-project setup the frontend and backend share an
   * origin, so CORS is not exercised. It is configured anyway for local dev
   * and so the backend could be split onto its own domain without changes.
   * No credentials: authentication is a Bearer token, never a cookie.
   */
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server requests send no Origin header.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Vercel preview deployments get a fresh subdomain each time.
        if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed'));
      },
      credentials: false,
    })
  );

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'networking-tracker-api' });
  });

  app.use('/api/contacts', contactsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof DataApiError) {
        const { status, body } = mapDataApiError(error);
        res.status(status).json(body);
        return;
      }

      if (error instanceof SyntaxError && 'body' in error) {
        res.status(400).json({ error: 'Request body is not valid JSON.' });
        return;
      }

      // Log server-side; never leak internals to the client.
      console.error('Unhandled error:', error);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  );

  return app;
}
