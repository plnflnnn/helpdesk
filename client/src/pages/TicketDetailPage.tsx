import { ArrowLeftIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router';
import { ticketIdParamsSchema, type TicketDetail, type TicketMessage } from '@helpdesk/shared';
import { getTicket, ticketQueryKey } from '@/api/tickets';
import { ReplyForm } from '@/components/tickets/ReplyForm';
import { StatusBadge } from '@/components/tickets/TicketBadges';
import { TicketSummary } from '@/components/tickets/TicketSummary';
import { TicketFieldsPanel } from '@/components/tickets/TicketFieldsPanel';
import { cn } from '@/lib/utils';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

function BackLink() {
  return (
    <Link
      to="/tickets"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      All tickets
    </Link>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <h1 className="text-2xl font-semibold">Ticket not found</h1>
    </div>
  );
}

export function TicketDetailPage() {
  const params = ticketIdParamsSchema.safeParse(useParams());
  const ticketId = params.data?.id;
  const ticket = useQuery({
    queryKey: ticketQueryKey(ticketId ?? 0),
    queryFn: () => getTicket(ticketId!),
    enabled: ticketId !== undefined,
  });

  if (ticketId === undefined) {
    return <NotFound />;
  }
  if (ticket.isPending) {
    return <p className="text-sm text-muted-foreground">Loading ticket…</p>;
  }
  if (ticket.isError) {
    if (isAxiosError(ticket.error) && ticket.error.response?.status === 404) {
      return <NotFound />;
    }
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <p className="text-sm text-destructive">Could not load ticket: {ticket.error.message}</p>
      </div>
    );
  }
  return <TicketView ticket={ticket.data} />;
}

function TicketView({ ticket }: { ticket: TicketDetail }) {
  const { student } = ticket;
  const studentName = student.name ?? student.email;
  // The first message is the student's original email; everything after it is the reply thread.
  const [originalMessage, ...replies] = ticket.messages;
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold break-words">{ticket.subject}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          #{ticket.id} · {student.name ? `${student.name} <${student.email}>` : student.email} ·
          Opened {formatDate(ticket.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <section aria-label="Message" className="flex flex-col gap-3">
            {originalMessage ? (
              <>
                <MessageCard message={originalMessage} studentName={studentName} />
                <TicketSummary key={ticket.id} ticketId={ticket.id} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No message.</p>
            )}
          </section>

          <section aria-labelledby="replies-heading" className="flex flex-col gap-4">
            <h2 id="replies-heading" className="text-lg font-semibold">
              Replies ({replies.length})
            </h2>
            {replies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No replies yet.</p>
            ) : (
              replies.map((reply) => (
                <MessageCard key={reply.id} message={reply} studentName={studentName} />
              ))
            )}
            <ReplyForm ticketId={ticket.id} />
          </section>
        </div>

        <aside
          aria-label="Ticket details"
          className="h-fit rounded-xl border bg-background p-4 lg:sticky lg:top-6"
        >
          <TicketFieldsPanel ticket={ticket} />
        </aside>
      </div>
    </div>
  );
}

function MessageCard({ message, studentName }: { message: TicketMessage; studentName: string }) {
  const outbound = message.direction === 'outbound';
  const sender = outbound ? (message.author?.name ?? 'Agent') : studentName;
  return (
    <article
      className={cn(
        'rounded-xl border p-4',
        outbound ? 'ml-8 border-primary/20 bg-primary/5' : 'mr-8 bg-background',
      )}
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{sender}</span>
        <time className="text-xs text-muted-foreground" dateTime={message.createdAt}>
          {formatDate(message.createdAt)}
        </time>
      </header>
      <p className="text-sm whitespace-pre-wrap break-words">{message.bodyText}</p>
    </article>
  );
}
