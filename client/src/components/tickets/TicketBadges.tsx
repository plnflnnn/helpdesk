import { ticketStatusLabels, type TicketStatus } from '@helpdesk/shared';
import { Badge } from '@/components/ui/badge';

const statusVariants = {
  open: 'default',
  pending: 'secondary',
  resolved: 'outline',
  closed: 'ghost',
} as const satisfies Record<TicketStatus, string>;

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={statusVariants[status]}>{ticketStatusLabels[status]}</Badge>;
}
