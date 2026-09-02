/**
 * Local development entry point: a plain Express server on PORT.
 * Vercel uses index.ts instead, which exports the app rather than listening.
 */
import app from './app.js';

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
