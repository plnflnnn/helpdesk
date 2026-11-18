import { useCallback } from 'react';
import { InboxIcon, SearchXIcon } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { functionalUpdate, type OnChangeFn, type SortingState } from '@tanstack/react-table';
import { listTicketsQuerySchema, type ListTicketsQuery } from '@helpdesk/shared';
import { listTickets, ticketsQueryKey } from '@/api/tickets';
import { TicketFilters, type TicketFilterValues } from '@/components/tickets/TicketFilters';
import { TicketsTable } from '@/components/tickets/TicketsTable';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const defaultQuery = listTicketsQuerySchema.parse({});

/**
 * The sort and filters from the URL (`?sortBy=createdAt&sortOrder=desc&status=open&search=refund`).
 * Falls back to the defaults when the URL holds something invalid.
 */
function parseQuery(params: URLSearchParams): ListTicketsQuery {
  const result = listTicketsQuerySchema.safeParse(Object.fromEntries(params));
  return result.success ? result.data : defaultQuery;
}

export function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseQuery(searchParams);
  const tickets = useQuery({
    queryKey: [...ticketsQueryKey, query],
    queryFn: () => listTickets(query),
    // Keep the current rows on screen while a new sort or filter loads.
    placeholderData: keepPreviousData,
  });
  const isFiltered = Boolean(query.search || query.status || query.category);

  const sorting: SortingState = [{ id: query.sortBy, desc: query.sortOrder === 'desc' }];
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const [sort] = functionalUpdate(updater, sorting);
    if (!sort) {
      return;
    }
    setSearchParams((params) => {
      params.set('sortBy', sort.id);
      params.set('sortOrder', sort.desc ? 'desc' : 'asc');
      return params;
    });
  };

  /** Sets the given filters in the URL; an empty value removes that filter. */
  const onFiltersChange = useCallback(
    (filters: TicketFilterValues) => {
      setSearchParams(
        (params) => {
          for (const [key, value] of Object.entries(filters)) {
            if (value) {
              params.set(key, value);
            } else {
              params.delete(key);
            }
          }
          return params;
        },
        { replace: 'search' in filters },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tickets</h1>

      <TicketFilters
        search={query.search}
        status={query.status}
        category={query.category}
        onChange={onFiltersChange}
      />

      <div className="rounded-xl border bg-background">
        {tickets.isPending && <p className="p-6 text-sm text-muted-foreground">Loading tickets…</p>}
        {tickets.isError && (
          <p className="p-6 text-sm text-destructive">
            Could not load tickets: {tickets.error.message}
          </p>
        )}
        {tickets.data?.length === 0 &&
          (isFiltered ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
              <SearchXIcon className="size-8" aria-hidden />
              <p>No tickets match these filters.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onFiltersChange({ search: undefined, status: undefined, category: undefined })
                }
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
              <InboxIcon className="size-8" aria-hidden />
              <p>No tickets yet. Incoming support email will show up here.</p>
            </div>
          ))}
        {tickets.data && tickets.data.length > 0 && (
          <div
            className={cn('transition-opacity', tickets.isPlaceholderData && 'opacity-60')}
            aria-busy={tickets.isPlaceholderData}
          >
            <TicketsTable
              tickets={tickets.data}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
