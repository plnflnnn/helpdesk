import path from 'node:path';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { UserResponse } from '@helpdesk/shared';
import { requireAuth } from '@/middleware/auth.js';
import { apiNotFound, errorHandler } from '@/middleware/error-handler.js';
import { healthRouter } from '@/routes/health.js';
import { ticketsRouter } from '@/routes/tickets.js';
import { usersRouter } from '@/routes/users.js';
import type { AppDependencies } from '@/types.js';

export function createApp({ checkDatabase, services, clientDistPath }: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');

  // Better Auth reads the raw request body, so it must be mounted before express.json().
  if (services) {
    app.all('/api/auth/{*splat}', toNodeHandler(services.auth));
  }

  app.use(express.json());

  app.use('/api/health', healthRouter(checkDatabase));

  if (services) {
    app.get('/api/me', requireAuth(services.auth), (req, res) => {
      const body: UserResponse = { user: req.user! };
      res.json(body);
    });
    app.use('/api/users', usersRouter(services));
    app.use('/api/tickets', ticketsRouter(services));
  }

  app.use('/api', apiNotFound);

  // In production the server also serves the React app, falling back to index.html for its routes.
  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
