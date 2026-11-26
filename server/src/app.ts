import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import prisma from '@/db.js';
import { auth } from '@/lib/auth.js';
import { errorHandler } from '@/middleware/error-handler.js';
import { requireAuth } from '@/middleware/require-auth.js';
import dashboardRouter from '@/routes/dashboard.js';
import repliesRouter from '@/routes/replies.js';
import ticketsRouter from '@/routes/tickets.js';
import usersRouter from '@/routes/users.js';
import webhooksRouter from '@/routes/webhooks.js';

export const app = express();
app.disable('x-powered-by');

// Better Auth parses its own request bodies, so it goes before express.json().
app.all('/api/auth/{*splat}', toNodeHandler(auth));

app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const databaseUp = await prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  res.status(databaseUp ? 200 : 503).json({
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use('/api/users', usersRouter);
app.use('/api/tickets/:ticketId/replies', repliesRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use('/webhooks', webhooksRouter);

// In production the server also serves the React app (on Vercel, its CDN does).
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const clientDist = fileURLToPath(new URL('../../../client/dist', import.meta.url));
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);
