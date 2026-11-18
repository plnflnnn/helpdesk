import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ticketCategoryLabels,
  ticketCategorySchema,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketStatusSchema,
  type TicketDetail,
  type UpdateTicketInput,
} from '@helpdesk/shared';
import {
  assigneesQueryKey,
  listAssignees,
  ticketQueryKey,
  ticketsQueryKey,
  updateTicket,
} from '@/api/tickets';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/errors';

/** Assignee select value meaning "nobody". */
const UNASSIGNED = 'unassigned';

type SelectFieldProps = {
  id: string;
  label: string;
  items: Record<string, string>;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

function SelectField({ id, label, items, value, disabled, onChange }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={`${id}-label`}>{label}</Label>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === 'string' && next !== value) {
            onChange(next);
          }
        }}
      >
        <SelectTrigger aria-labelledby={`${id}-label`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([itemValue, itemLabel]) => (
            <SelectItem key={itemValue} value={itemValue}>
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Status, category and assignee controls. Each change is saved right away. */
export function TicketFieldsPanel({ ticket }: { ticket: TicketDetail }) {
  const queryClient = useQueryClient();
  const assignees = useQuery({ queryKey: assigneesQueryKey, queryFn: listAssignees });
  const save = useMutation({
    mutationFn: (input: UpdateTicketInput) => updateTicket(ticket.id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(ticketQueryKey(ticket.id), updated);
      await queryClient.invalidateQueries({ queryKey: ticketsQueryKey });
    },
  });

  const assigneeItems: Record<string, string> = { [UNASSIGNED]: 'Unassigned' };
  for (const agent of assignees.data ?? []) {
    assigneeItems[agent.id] = agent.name;
  }

  return (
    <div className="flex flex-col gap-4">
      {save.error && (
        <Alert variant="destructive">
          <AlertDescription>Could not save: {errorMessage(save.error)}</AlertDescription>
        </Alert>
      )}
      <SelectField
        id="ticket-status"
        label="Status"
        items={ticketStatusLabels}
        value={ticket.status}
        disabled={save.isPending}
        onChange={(value) => save.mutate({ status: ticketStatusSchema.parse(value) })}
      />
      <SelectField
        id="ticket-category"
        label="Category"
        items={ticketCategoryLabels}
        value={ticket.category}
        disabled={save.isPending}
        onChange={(value) => save.mutate({ category: ticketCategorySchema.parse(value) })}
      />
      {assignees.isSuccess ? (
        <SelectField
          id="ticket-assignee"
          label="Assignee"
          items={assigneeItems}
          value={ticket.assignee?.id ?? UNASSIGNED}
          disabled={save.isPending}
          onChange={(value) => save.mutate({ assigneeId: value === UNASSIGNED ? null : value })}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Assignee</span>
          {assignees.isError ? (
            <span className="text-sm text-destructive">Could not load agents to assign.</span>
          ) : (
            <span className="text-sm text-muted-foreground">Loading agents…</span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Priority</span>
        <span className="text-sm text-muted-foreground">
          {ticketPriorityLabels[ticket.priority]}
        </span>
      </div>
    </div>
  );
}
