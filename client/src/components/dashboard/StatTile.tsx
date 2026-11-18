import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface StatTileProps {
  label: string;
  value: string;
  /** Short context under the value, e.g. "12 of 100 tickets". */
  detail?: string;
  icon: LucideIcon;
  className?: string;
}

/** One headline number: a cell of the dashboard's figures strip (`StatStrip`). */
export function StatTile({ label, value, detail, icon: Icon, className }: StatTileProps) {
  return (
    <div data-slot="card" className={cn('flex flex-col gap-1 bg-card p-5', className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <h2 className="font-sans text-sm">{label}</h2>
      </div>
      <p className="mt-1 font-display text-[2.25rem] leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/**
 * The figures share one panel, divided by hairlines, instead of floating as separate cards.
 * The 1px gap shows the border colour behind the cells.
 */
export function StatStrip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section
      aria-label={label}
      className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-5 [&>*:last-child]:sm:col-span-2 [&>*:last-child]:lg:col-span-1"
    >
      {children}
    </section>
  );
}

export function StatStripSkeleton({ count = 5 }: { count?: number }) {
  return (
    <StatStrip label="Loading ticket metrics">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 bg-card p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </StatStrip>
  );
}
