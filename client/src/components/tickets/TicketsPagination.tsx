import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TicketsPaginationProps = {
  /** The current page, starting at 1. */
  page: number;
  pageCount: number;
  pageSize: number;
  /** How many tickets match the filters, across all pages. */
  total: number;
  onPageChange: (page: number) => void;
};

/** "Showing 26–50 of 120" with Previous / Next buttons, below the tickets table. */
export function TicketsPagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: TicketsPaginationProps) {
  const firstShown = (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"
    >
      <p className="text-muted-foreground">
        Showing {firstShown}–{lastShown} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" aria-hidden />
          Previous
        </Button>
        <span className="px-1 tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRightIcon data-icon="inline-end" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
