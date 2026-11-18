import { useCallback, useEffect } from 'react';
import { InboxIcon, SearchXIcon } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { functionalUpdate, type OnChangeFn, type SortingState } from '@tanstack/react-table';
import { listTicketsQuerySchema, type ListTicketsQuery } from '@helpdesk/shared';
import { listTickets, ticketsQueryKey } from '@/api/tickets';
import { TicketFilters, type TicketFilterValues } from '@/components/tickets/TicketFilters';
import { TicketsPagination } from '@/components/tickets/TicketsPagination';
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
  const total = tickets.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  /** Shows the given page; page 1 is left out of the URL. */
  const onPageChange = useCallback(
    (page: number, options?: { replace?: boolean }) => {
      setSearchParams((params) => {
        if (page > 1) {
          params.set('page', String(page));
        } else {
          params.delete('page');
        }
        return params;
      }, options);
    },
    [setSearchParams],
  );

  // A page past the end (e.g. after tickets were closed or the URL was edited) shows the last page.
  useEffect(() => {
    if (tickets.data && query.page > pageCount) {
      onPageChange(pageCount, { replace: true });
    }
  }, [tickets.data, query.page, pageCount, onPageChange]);

  const sorting: SortingState = [{ id: query.sortBy, desc: query.sortOrder === 'desc' }];
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const [sort] = functionalUpdate(updater, sorting);
    if (!sort) {
      return;
    }
    setSearchParams((params) => {
      params.set('sortBy', sort.id);
      params.set('sortOrder', sort.desc ? 'desc' : 'asc');
      // A new sort starts from the first page.
      params.delete('page');
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
          // New filters start from the first page.
          params.delete('page');
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
        {total === 0 &&
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
        {tickets.data && total > 0 && (
          <div
            className={cn('transition-opacity', tickets.isPlaceholderData && 'opacity-60')}
            aria-busy={tickets.isPlaceholderData}
          >
            <TicketsTable
              tickets={tickets.data.tickets}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />
            <TicketsPagination
              page={Math.min(query.page, pageCount)}
              pageCount={pageCount}
              pageSize={query.pageSize}
              total={total}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
