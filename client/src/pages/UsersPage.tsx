import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlusIcon } from 'lucide-react';
import type { User } from '@helpdesk/shared';
import { listUsers, usersQueryKey } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DeactivateDialog } from '@/components/users/DeactivateDialog';
import { DeleteUserDialog } from '@/components/users/DeleteUserDialog';
import { UserFormDialog } from '@/components/users/UserFormDialog';
import { UserRow } from '@/components/users/UserRow';

export function UsersPage() {
  const users = useQuery({ queryKey: usersQueryKey, queryFn: listUsers });
  // `user` is kept after closing so the dialog doesn't flip from "Edit" to "Add" while it animates out.
  const [form, setForm] = useState<{ open: boolean; user?: User }>({ open: false });
  const [toDeactivate, setToDeactivate] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => setForm({ open: true })}>
          <UserPlusIcon data-icon="inline-start" aria-hidden />
          Add agent
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        {users.isPending && <p className="p-6 text-sm text-muted-foreground">Loading users…</p>}
        {users.isError && (
          <p className="p-6 text-sm text-destructive">
            Could not load users: {users.error.message}
          </p>
        )}
        {users.data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onEdit={() => setForm({ open: true, user })}
                  onDeactivate={() => setToDeactivate(user)}
                  onDelete={() => setToDelete(user)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <UserFormDialog
        open={form.open}
        user={form.user}
        onOpenChange={(open) => setForm((prev) => ({ ...prev, open }))}
      />
      <DeactivateDialog user={toDeactivate} onClose={() => setToDeactivate(null)} />
      <DeleteUserDialog user={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
