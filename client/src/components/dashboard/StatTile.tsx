import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatTileProps {
  label: string;
  value: string;
  /** Short context under the value, e.g. "12 of 100 tickets". */
  detail?: string;
  icon: LucideIcon;
}

/** One headline number on the dashboard. */
export function StatTile({ label, value, detail, icon: Icon }: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <h2 className="text-sm font-medium">{label}</h2>
          <Icon className="size-4" aria-hidden />
        </div>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}
