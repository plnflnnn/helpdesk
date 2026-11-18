import { ticketStatusLabels, type TicketStatus } from '@helpdesk/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Open tickets carry the highlighter yellow: they still need someone. */
const statusClasses = {
  open: 'bg-highlight text-highlight-foreground',
  pending: 'bg-status-pending text-status-pending-foreground',
  resolved: 'bg-status-resolved text-status-resolved-foreground',
  closed: 'border-border bg-transparent text-muted-foreground',
} as const satisfies Record<TicketStatus, string>;

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant="secondary" className={cn('rounded-md', statusClasses[status])}>
      {ticketStatusLabels[status]}
    </Badge>
  );
}
