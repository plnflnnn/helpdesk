import { useEffect, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import {
  TICKET_SEARCH_MAX_LENGTH,
  ticketCategoryLabels,
  ticketStatusLabels,
  ticketCategorySchema,
  ticketStatusSchema,
  type TicketCategory,
  type TicketStatus,
} from '@helpdesk/shared';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Select value meaning "no filter". */
const ALL = 'all';

const statusItems = { [ALL]: 'All statuses', ...ticketStatusLabels };
const categoryItems = { [ALL]: 'All categories', ...ticketCategoryLabels };

/** How long typing has to pause before the search is sent. */
const SEARCH_DELAY_MS = 300;

export type TicketFilterValues = {
  search?: string;
  status?: TicketStatus;
  category?: TicketCategory;
};

type TicketFiltersProps = TicketFilterValues & {
  onChange: (filters: TicketFilterValues) => void;
};

export function TicketFilters({ search = '', status, category, onChange }: TicketFiltersProps) {
  const [searchText, setSearchText] = useState(search);

  // Follow search changes made elsewhere ("Clear filters", back button) without losing typed text.
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    if (search !== searchText.trim()) {
      setSearchText(search);
    }
  }

  useEffect(() => {
    if (searchText.trim() === search) {
      return;
    }
    const timeout = setTimeout(
      () =>
        onChange({
          search: searchText.trim(),
        }),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchText, search, onChange]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <div className="relative col-span-2 sm:w-80">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search tickets"
          placeholder="Search subject, message or sender…"
          className="h-9 bg-card pl-8"
          maxLength={TICKET_SEARCH_MAX_LENGTH}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>

      <Select
        items={statusItems}
        value={status ?? ALL}
        onValueChange={(value) => onChange({ status: ticketStatusSchema.safeParse(value).data })}
      >
        <SelectTrigger aria-label="Status" className="w-full bg-card sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={categoryItems}
        value={category ?? ALL}
        onValueChange={(value) =>
          onChange({ category: ticketCategorySchema.safeParse(value).data })
        }
      >
        <SelectTrigger aria-label="Category" className="w-full bg-card sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(categoryItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
