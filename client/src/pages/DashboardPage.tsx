import { BotIcon, CheckCircle2Icon, InboxIcon, PercentIcon, TimerIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DASHBOARD_DAYS } from '@helpdesk/shared';
import { dashboardQueryKey, getDashboardStats } from '@/api/dashboard';
import { StatTile } from '@/components/dashboard/StatTile';
import { TicketsPerDayChart } from '@/components/dashboard/TicketsPerDayChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const numberFormat = new Intl.NumberFormat();
const percentFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 1,
});

const durationUnits = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
] as const;

/** In the largest whole unit: 90 → "2m", 5_400 → "1.5h", 200_000 → "2.3d". At least "1m". */
export function formatDuration(seconds: number) {
  const value = Math.max(seconds, 60);
  const [unit, size] = durationUnits.find(([, size]) => value >= size)!;
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit,
    unitDisplay: 'narrow',
    maximumFractionDigits: unit === 'minute' ? 0 : 1,
  }).format(value / size);
}

export function DashboardPage() {
  const stats = useQuery({ queryKey: dashboardQueryKey, queryFn: getDashboardStats });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {stats.isPending && <p className="text-sm text-muted-foreground">Loading metrics…</p>}
      {stats.isError && (
        <p className="text-sm text-destructive">Could not load metrics: {stats.error.message}</p>
      )}

      {stats.data && (
        <>
          <section
            aria-label="Ticket metrics"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            <StatTile
              label="Total tickets"
              value={numberFormat.format(stats.data.totalTickets)}
              icon={InboxIcon}
            />
            <StatTile
              label="Open tickets"
              value={numberFormat.format(stats.data.openTickets)}
              detail="Waiting for an agent"
              icon={CheckCircle2Icon}
            />
            <StatTile
              label="Resolved by AI"
              value={numberFormat.format(stats.data.resolvedByAi)}
              detail="Answered from the knowledge base"
              icon={BotIcon}
            />
            <StatTile
              label="Resolved by AI (%)"
              value={percentFormat.format(
                stats.data.totalTickets ? stats.data.resolvedByAi / stats.data.totalTickets : 0,
              )}
              detail={`${numberFormat.format(stats.data.resolvedByAi)} of ${numberFormat.format(stats.data.totalTickets)} tickets`}
              icon={PercentIcon}
            />
            <StatTile
              label="Avg. resolution time"
              value={
                stats.data.averageResolutionSeconds === null
                  ? '—'
                  : formatDuration(stats.data.averageResolutionSeconds)
              }
              detail="From first email to resolved"
              icon={TimerIcon}
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Tickets per day</CardTitle>
              <CardDescription>New tickets over the last {DASHBOARD_DAYS} days</CardDescription>
            </CardHeader>
            <CardContent>
              <TicketsPerDayChart days={stats.data.ticketsPerDay} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
