import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { Role, type User } from '@helpdesk/shared';
import { setUserActive, usersQueryKey } from '@/api/users';
import { useCurrentUser } from '@/auth/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type UserRowProps = {
  user: User;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
};

export function UserRow({ user, onEdit, onDeactivate, onDelete }: UserRowProps) {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const reactivate = useMutation({
    mutationFn: () => setUserActive(user.id, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
  const isSelf = currentUser?.id === user.id;

  return (
    // On phones the row becomes a small grid:  Name ... Status / Email / Role ... Actions
    <TableRow
      className={cn(
        'max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1 max-md:px-4 max-md:py-3',
        !user.active && 'text-muted-foreground',
      )}
    >
      <TableCell className="py-3 pl-4 font-medium max-md:col-start-1 max-md:row-start-1 max-md:block max-md:truncate max-md:p-0">
        {user.name}
        {isSelf && <span className="ml-1 font-normal text-muted-foreground">(you)</span>}
      </TableCell>
      <TableCell className="max-md:col-span-2 max-md:row-start-2 max-md:block max-md:truncate max-md:p-0 max-md:text-sm max-md:text-muted-foreground">
        {user.email}
      </TableCell>
      <TableCell className="capitalize max-md:col-start-1 max-md:row-start-3 max-md:block max-md:p-0 max-md:text-xs max-md:text-muted-foreground">
        {user.role}
      </TableCell>
      <TableCell className="max-md:col-start-2 max-md:row-start-1 max-md:block max-md:p-0 max-md:justify-self-end">
        {user.active ? (
          <Badge
            variant="secondary"
            className="rounded-md bg-status-resolved text-status-resolved-foreground"
          >
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-md text-muted-foreground">
            Deactivated
          </Badge>
        )}
      </TableCell>
      <TableCell className="pr-4 max-md:col-start-2 max-md:row-start-3 max-md:block max-md:p-0 max-md:justify-self-end">
        <div className="flex items-center gap-1 max-md:-mr-2">
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${user.name}`} onClick={onEdit}>
            <PencilIcon aria-hidden />
          </Button>
          {user.role !== Role.admin && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${user.name}`}
              onClick={onDelete}
            >
              <Trash2Icon aria-hidden />
            </Button>
          )}
          {user.active ? (
            !isSelf && (
              <Button variant="ghost" size="sm" onClick={onDeactivate}>
                Deactivate
              </Button>
            )
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
            >
              Reactivate
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
