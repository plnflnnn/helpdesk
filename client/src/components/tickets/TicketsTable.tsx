import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table';
import { ticketCategoryLabels, type TicketListItem } from '@helpdesk/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/tickets/TicketBadges';
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
const columns = column.columns([
  column.accessor('subject', {
    header: 'Subject',
    cell: (info) => (
      <span className="block max-w-96 truncate font-medium" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  column.accessor('student', {
    header: 'Sender',
    cell: (info) => {
      const { name, email } = info.getValue();
      return (
        <div className="flex flex-col">
          <span>{name ?? email}</span>
          {name && <span className="text-xs text-muted-foreground">{email}</span>}
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
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
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
                  className="first:pl-4 last:pr-4"
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
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id} className="first:pl-4 last:pr-4">
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
