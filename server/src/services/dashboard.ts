import { DASHBOARD_DAYS, dashboardStatsSchema, type DashboardStats } from '@helpdesk/shared';
import type { Database } from '@/db.js';

/**
 * The dashboard metrics, computed by the `dashboard_stats` database function (see its migration).
 * `timeZone` (IANA) decides where each day starts in `ticketsPerDay`.
 */
export async function getDashboardStats(db: Database, timeZone: string): Promise<DashboardStats> {
  const [row] = await db.$queryRaw<[{ stats: unknown }]>`
    SELECT dashboard_stats(${timeZone}, ${DASHBOARD_DAYS}::int) AS stats`;
  return dashboardStatsSchema.parse(row.stats);
}
