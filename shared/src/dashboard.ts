import { z } from 'zod';

/** Query of `GET /api/dashboard`: the viewer's IANA time zone, so "per day" follows their calendar. */
export const dashboardQuerySchema = z.object({
  timeZone: z.string().max(64).refine(isTimeZone, 'Unknown time zone').default('UTC'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** Number of days in the tickets-per-day chart, ending today. */
export const DASHBOARD_DAYS = 30;

export const dashboardStatsSchema = z.object({
  totalTickets: z.number().int().nonnegative(),
  openTickets: z.number().int().nonnegative(),
  /** Resolved or closed tickets that only the AI replied to. */
  resolvedByAi: z.number().int().nonnegative(),
  /** Average time from creation to resolution, over resolved and closed tickets; null when none. */
  averageResolutionSeconds: z.number().nonnegative().nullable(),
  /** One entry per day for the last `DASHBOARD_DAYS` days, oldest first, including days with none. */
  ticketsPerDay: z.array(
    z.object({
      /** `YYYY-MM-DD` in the requested time zone. */
      date: z.iso.date(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const dashboardResponseSchema = z.object({ stats: dashboardStatsSchema });
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
