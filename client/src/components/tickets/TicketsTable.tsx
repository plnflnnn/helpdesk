import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table';
import { Link } from 'react-router';
import { ticketCategoryLabels, type TicketListItem } from '@helpdesk/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/tickets/TicketBadges';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const features = tableFeatures({ rowSortingFeature });
const column = createColumnHelper<typeof features, TicketListItem>();

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

// Column ids match the server's sort fields (`TicketSortField`).
/**
 * On phones the table restyles into stacked rows (the same markup, not a second copy):
 *   Subject (full width)
 *   Sender ............ Status
 *   Category .......... Created
 */
const cellClasses: Record<string, string> = {
  subject: 'max-md:col-span-2',
  student: 'max-md:min-w-0',
  status: 'max-md:justify-self-end',
  category: 'text-muted-foreground max-md:text-xs',
  createdAt: 'text-muted-foreground tabular-nums max-md:justify-self-end max-md:text-xs',
};

const columns = column.columns([
  column.accessor('subject', {
    header: 'Subject',
    cell: (info) => (
      <Link
        to={`/tickets/${info.row.original.id}`}
        className={cn(
          'block max-w-[28rem] truncate text-[0.9375rem] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:max-w-none max-md:whitespace-normal',
          // Like unread mail: open tickets still need someone, so they stand out in bold.
          info.row.original.status === 'open' ? 'font-bold' : 'font-normal',
        )}
        title={info.getValue()}
      >
        {info.getValue()}
      </Link>
    ),
  }),
  column.accessor('student', {
    header: 'Sender',
    cell: (info) => {
      const { name, email } = info.getValue();
      return (
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{name ?? email}</span>
          {name && (
            <span className="truncate text-xs text-muted-foreground max-md:hidden">{email}</span>
          )}
        </div>
      );
    },
  }),
  column.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  column.accessor('category', {
    header: 'Category',
    cell: (info) => ticketCategoryLabels[info.getValue()],
  }),
  // Newest first on the first click.
  column.accessor('createdAt', {
    header: 'Created',
    cell: (info) => formatDate(info.getValue()),
    sortDescFirst: true,
  }),
]);

type TicketsTableProps = {
  tickets: TicketListItem[];
  /** Exactly one column; the server does the sorting. */
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
};

export function TicketsTable({ tickets, sorting, onSortingChange }: TicketsTableProps) {
  const table = useTable({
    features,
    columns,
    data: tickets,
    getRowId: (ticket) => String(ticket.id),
    state: { sorting },
    onSortingChange,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
  });

  return (
    <Table className="max-md:block">
      {/* On phones the header row becomes a scrollable row of sort buttons. */}
      <TableHeader className="max-md:block">
        {table.getHeaderGroups().map((group) => (
          <TableRow
            key={group.id}
            className="bg-muted/50 hover:bg-muted/50 max-md:flex max-md:gap-1 max-md:overflow-x-auto max-md:px-2 max-md:py-1.5"
          >
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              const SortIcon =
                sorted === 'asc'
                  ? ArrowUpIcon
                  : sorted === 'desc'
                    ? ArrowDownIcon
                    : ArrowUpDownIcon;
              return (
                <TableHead
                  key={header.id}
                  className="text-xs font-medium text-muted-foreground first:pl-4 last:pr-4 max-md:h-8 max-md:px-1.5 max-md:first:pl-1.5"
                  aria-sort={
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                  }
                >
                  <button
                    type="button"
                    className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <table.FlexRender header={header} />
                    <SortIcon
                      className={cn('size-3.5', !sorted && 'text-muted-foreground/60')}
                      aria-hidden
                    />
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className="max-md:block">
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className="max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1 max-md:px-4 max-md:py-3"
          >
            {row.getAllCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cn(
                  'py-3 first:pl-4 last:pr-4 max-md:block max-md:p-0 max-md:first:pl-0 max-md:last:pr-0',
                  cellClasses[cell.column.id],
                )}
              >
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Placeholder rows in the shape of the tickets table, shown while the first page loads. */
export function TicketsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonRegion label="Loading tickets…">
      <div className="hidden h-10 items-center gap-6 border-b bg-muted/50 px-4 md:flex">
        {['w-16', 'w-14', 'w-12', 'w-16', 'w-14'].map((width, index) => (
          <Skeleton key={index} className={cn('h-3', width, index === 0 && 'mr-auto')} />
        ))}
      </div>
      <ul className="divide-y">
        {Array.from({ length: rows }, (_, index) => (
          <li
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_5rem_minmax(0,1fr)_8rem] md:gap-x-6"
          >
            <Skeleton
              className="col-span-2 h-4 md:col-span-1"
              style={{ width: `${55 + ((index * 23) % 40)}%` }}
            />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="hidden h-3 w-40 md:block" />
            </div>
            <Skeleton className="h-5 w-16 justify-self-end rounded-md md:justify-self-start" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20 justify-self-end md:w-28 md:justify-self-start" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}
