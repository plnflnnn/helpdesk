import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { DashboardStats } from '@helpdesk/shared';

type Day = DashboardStats['ticketsPerDay'][number];

/** `2026-11-03` is a calendar date, so it is formatted in UTC to avoid shifting a day. */
const formatDay = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });

const ticketsLabel = (count: number) => `${count} ${count === 1 ? 'ticket' : 'tickets'}`;

function DayTooltip({ active, payload }: Pick<TooltipContentProps, 'active' | 'payload'>) {
  const day = payload?.[0]?.payload as Day | undefined;
  if (!active || !day) {
    return null;
  }
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      <div className="text-muted-foreground">
        {formatDay(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
      <div className="font-medium tabular-nums">{ticketsLabel(day.count)}</div>
    </div>
  );
}

const axisTick = { fontSize: 12, fill: 'var(--color-muted-foreground)' };

/** Bar chart of tickets created per day, oldest on the left; a table holds the same numbers for screen readers. */
export function TicketsPerDayChart({ days }: { days: Day[] }) {
  // One label a week, counted back from today so the last day is always labelled.
  const weeklyTicks = days
    .filter((_, index) => (days.length - 1 - index) % 7 === 0)
    .map((day) => day.date);

  return (
    <figure>
      <BarChart
        data={days}
        responsive
        style={{ width: '100%', height: 240 }}
        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        barCategoryGap={2}
      >
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          ticks={weeklyTicks}
          tickFormatter={(date: string) => formatDay(date, { month: 'short', day: 'numeric' })}
          tick={axisTick}
          tickLine={false}
          stroke="var(--color-border)"
        />
        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip content={DayTooltip} cursor={{ fill: 'var(--color-muted)' }} />
        <Bar dataKey="count" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>

      <table className="sr-only">
        <caption>Tickets created per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Tickets</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{formatDay(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
