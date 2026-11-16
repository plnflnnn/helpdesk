import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { HealthResponse, MeResponse } from '@helpdesk/shared';
import type { Auth } from './auth.js';
import type { Database } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { invitesRouter } from './routes/invites.js';
import { usersRouter } from './routes/users.js';

export interface AppDependencies {
  checkDatabase: () => Promise<boolean>;
  /** Auth and user routes are mounted only when set (health-check tests run without them). */
  services?: {
    db: Database;
    auth: Auth;
    /** Public URL of the React app, used to build invite links. */
    appUrl: string;
  };
  /** Directory of the built React app. Served only when set (production). */
  clientDistPath?: string;
}

export function createApp({ checkDatabase, services, clientDistPath }: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');

  // Better Auth reads the raw request body, so it must be mounted before express.json().
  if (services) {
    app.all('/api/auth/{*splat}', toNodeHandler(services.auth));
  }

  app.use(express.json());

  app.get('/api/health', async (_req, res) => {
    const databaseUp = await checkDatabase();
    const body: HealthResponse = {
      status: databaseUp ? 'ok' : 'degraded',
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
    res.status(databaseUp ? 200 : 503).json(body);
  });

  if (services) {
    const { auth, db, appUrl } = services;

    app.get('/api/me', requireAuth(auth), (req, res) => {
      const body: MeResponse = { user: req.user! };
      res.json(body);
    });
    app.use('/api/users', usersRouter({ auth, db, appUrl }));
    app.use('/api/invites', invitesRouter({ db }));
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  };

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use(handleError);

  return app;
}
