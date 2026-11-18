import axios from 'axios';
import { dashboardResponseSchema } from '@helpdesk/shared';

export const dashboardQueryKey = ['dashboard'] as const;

/** Dashboard metrics; days in the tickets-per-day chart follow the browser's time zone. */
export async function getDashboardStats() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data } = await axios.get('/api/dashboard', { params: { timeZone } });
  return dashboardResponseSchema.parse(data).stats;
}
