import { InboxIcon } from 'lucide-react';

/** Placeholder until the ticket list arrives in Phase 4. */
export function TicketsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tickets</h1>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background p-12 text-center text-muted-foreground">
        <InboxIcon className="size-8" aria-hidden />
        <p>No tickets yet. Incoming support email will show up here.</p>
      </div>
    </div>
  );
}
