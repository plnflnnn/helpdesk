import { BotIcon, CheckCircle2Icon, InboxIcon, PercentIcon, TimerIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DASHBOARD_DAYS } from '@helpdesk/shared';
import { dashboardQueryKey, getDashboardStats } from '@/api/dashboard';
import { useCurrentUser } from '@/auth/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatStrip, StatStripSkeleton, StatTile } from '@/components/dashboard/StatTile';
import { TicketsPerDayChart } from '@/components/dashboard/TicketsPerDayChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

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

/** "Good morning, Alan." by the viewer's clock. */
function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name.split(/\s+/)[0]}.`;
}

export function DashboardPage() {
  const stats = useQuery({ queryKey: dashboardQueryKey, queryFn: getDashboardStats });
  const { data: user } = useCurrentUser();
  const open = stats.data?.openTickets;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description={
          <>
            {user && `${greeting(user.name)} `}
            {open === undefined ? null : open === 0 ? (
              'Every ticket has been picked up.'
            ) : (
              <>
                <span className="highlighter font-medium text-foreground">
                  {numberFormat.format(open)} {open === 1 ? 'ticket is' : 'tickets are'} waiting
                </span>{' '}
                for an agent.
              </>
            )}
          </>
        }
      />

      {stats.isPending && (
        <SkeletonRegion label="Loading metrics…" className="flex flex-col gap-8">
          <StatStripSkeleton />
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-60 w-full" />
          </div>
        </SkeletonRegion>
      )}
      {stats.isError && (
        <p className="text-sm text-destructive">Could not load metrics: {stats.error.message}</p>
      )}

      {stats.data && (
        <>
          <StatStrip label="Ticket metrics">
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
          </StatStrip>

          <Card className="rounded-lg shadow-none ring-0 border">
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold tracking-tight">
                <h2>Tickets per day</h2>
              </CardTitle>
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
