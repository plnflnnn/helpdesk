import { Router } from 'express';
import { dashboardQuerySchema, type DashboardResponse } from '@helpdesk/shared';
import { requireAuth } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { getDashboardStats } from '@/services/dashboard.js';
import type { Services } from '@/types.js';

/** Ticket metrics for the dashboard, available to every signed-in agent and admin. */
export function dashboardRouter({ db, auth }: Services) {
  const router = Router();
  router.use(requireAuth(auth));

  router.get('/', validate({ query: dashboardQuerySchema }), async (req, res) => {
    const body: DashboardResponse = { stats: await getDashboardStats(db, req.query.timeZone) };
    res.json(body);
  });

  return router;
}
