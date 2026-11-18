import { Router } from 'express';
import type { HealthResponse } from '@helpdesk/shared';
import type { AppDependencies } from '@/types.js';

/** Public health check: 200 when the database is reachable, 503 otherwise. */
export function healthRouter(checkDatabase: AppDependencies['checkDatabase']) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const databaseUp = await checkDatabase();
    const body: HealthResponse = {
      status: databaseUp ? 'ok' : 'degraded',
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
    res.status(databaseUp ? 200 : 503).json(body);
  });

  return router;
}
