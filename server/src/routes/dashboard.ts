import { Router } from 'express';
import { DASHBOARD_DAYS, dashboardQuerySchema, dashboardStatsSchema } from '@helpdesk/shared';
import prisma from '@/db.js';
import { validate } from '@/lib/validate.js';
import { requireAuth } from '@/middleware/require-auth.js';

const router = Router();

/** Ticket metrics from the `dashboard_stats` database function (see its migration). */
router.get('/', requireAuth, async (req, res) => {
  const query = validate(dashboardQuerySchema, req.query, res);
  if (!query) return;

  // `timeZone` decides where each day starts in the tickets-per-day chart.
  const [row] = await prisma.$queryRaw<[{ stats: unknown }]>`
    SELECT dashboard_stats(${query.timeZone}, ${DASHBOARD_DAYS}::int) AS stats`;
  res.json({ stats: dashboardStatsSchema.parse(row.stats) });
});

export default router;
