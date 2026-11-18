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
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

function BackLink() {
  return (
    <Link
      to="/tickets"
      className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
      <h1 className="text-[1.75rem] font-semibold tracking-tight">Ticket not found</h1>
      <p className="text-muted-foreground">
        It may have been deleted, or the link has a wrong ticket number.
      </p>
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
    return <TicketDetailSkeleton />;
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
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight break-words md:text-[2rem]">
            {ticket.subject}
          </h1>
          <span className="pt-1.5 md:pt-2.5">
            <StatusBadge status={ticket.status} />
          </span>
        </div>
        <p className="text-sm break-words text-muted-foreground">
          #{ticket.id} · {student.name ? `${student.name} <${student.email}>` : student.email} ·
          Opened {formatDate(ticket.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
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
            <h2 id="replies-heading" className="text-lg font-semibold tracking-tight">
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
          className="h-fit rounded-lg border bg-card p-5 lg:sticky lg:top-10"
        >
          <TicketFieldsPanel ticket={ticket} />
        </aside>
      </div>
    </div>
  );
}

function MessageCard({ message, studentName }: { message: TicketMessage; studentName: string }) {
  const outbound = message.direction === 'outbound';
  // Outbound messages without an author are the AI's auto-replies.
  const sender = outbound ? (message.author?.name ?? 'Support Team (AI)') : studentName;
  return (
    <article
      className={cn(
        'rounded-lg border p-4 md:p-5',
        // Student letters sit left on white; support replies sit right on a moss tint.
        outbound
          ? 'ml-4 border-primary/25 bg-primary/[0.06] sm:ml-12'
          : 'mr-4 bg-card shadow-[0_1px_0_var(--color-border)] sm:mr-12',
      )}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-display font-semibold">{sender}</span>
        <time className="text-xs text-muted-foreground tabular-nums" dateTime={message.createdAt}>
          {formatDate(message.createdAt)}
        </time>
      </header>
      <p className="max-w-[70ch] text-[0.9375rem] leading-relaxed whitespace-pre-wrap break-words">
        {message.bodyText}
      </p>
    </article>
  );
}

/** The ticket page's shape while it loads: title, the student's email, and the details panel. */
function TicketDetailSkeleton() {
  return (
    <SkeletonRegion label="Loading ticket…" className="flex flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-3/4 max-w-lg" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
        <Skeleton className="h-4 w-2/3 max-w-sm" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
        <div className="flex flex-col gap-4">
          <div className="mr-4 flex flex-col gap-3 rounded-lg border bg-card p-5 sm:mr-12">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-2 h-5 w-24" />
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-28 w-full" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
        <div className="flex h-fit flex-col gap-5 rounded-lg border bg-card p-5">
          {['Status', 'Category', 'Assignee', 'Priority'].map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
