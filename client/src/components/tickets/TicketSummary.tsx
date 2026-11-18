import { SparklesIcon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { summarizeTicket } from '@/api/tickets';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';

/** A button that asks the AI to summarize the ticket and its conversation, and shows the summary. */
export function TicketSummary({ ticketId }: { ticketId: number }) {
  const summarize = useMutation({ mutationFn: () => summarizeTicket(ticketId) });

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={summarize.isPending}
        onClick={() => summarize.mutate()}
      >
        <SparklesIcon aria-hidden />
        {summarize.isPending ? 'Summarizing…' : 'Summarize'}
      </Button>
      {summarize.error && (
        <Alert variant="destructive">
          <AlertDescription>
            Could not summarize the ticket: {errorMessage(summarize.error)}
          </AlertDescription>
        </Alert>
      )}
      {summarize.data && (
        <section
          aria-labelledby="summary-heading"
          className="rounded-xl border border-dashed bg-muted/40 p-4"
        >
          <h2
            id="summary-heading"
            className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
          >
            <SparklesIcon className="size-4" aria-hidden />
            Summary
          </h2>
          <p className="text-sm whitespace-pre-wrap break-words">{summarize.data}</p>
        </section>
      )}
    </div>
  );
}
