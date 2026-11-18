import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilIcon } from 'lucide-react';
import type { User } from '@helpdesk/shared';
import { setUserActive, usersQueryKey } from '@/api/users';
import { useCurrentUser } from '@/auth/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

type UserRowProps = {
  user: User;
  onEdit: () => void;
  onDeactivate: () => void;
};

export function UserRow({ user, onEdit, onDeactivate }: UserRowProps) {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const reactivate = useMutation({
    mutationFn: () => setUserActive(user.id, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
  const isSelf = currentUser?.id === user.id;

  return (
    <TableRow className={user.active ? undefined : 'text-muted-foreground'}>
      <TableCell className="pl-4 font-medium">
        {user.name}
        {isSelf && <span className="ml-1 font-normal text-muted-foreground">(you)</span>}
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell className="capitalize">{user.role}</TableCell>
      <TableCell>
        {user.active ? (
          <Badge variant="secondary">Active</Badge>
        ) : (
          <Badge variant="outline">Deactivated</Badge>
        )}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${user.name}`} onClick={onEdit}>
            <PencilIcon aria-hidden />
          </Button>
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
