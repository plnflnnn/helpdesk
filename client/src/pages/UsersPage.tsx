import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlusIcon } from 'lucide-react';
import type { User } from '@helpdesk/shared';
import { listUsers, usersQueryKey } from '@/api/users';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
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
      <PageHeader
        title="Users"
        description="The agents and admins who can sign in and answer tickets."
        actions={
          <Button size="lg" className="px-3" onClick={() => setForm({ open: true })}>
            <UserPlusIcon data-icon="inline-start" aria-hidden />
            Add agent
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        {users.isPending && <UsersTableSkeleton />}
        {users.isError && (
          <p className="p-6 text-sm text-destructive">
            Could not load users: {users.error.message}
          </p>
        )}
        {users.data && (
          <Table className="max-md:block">
            {/* Column names are left out on phones, where each row is stacked. */}
            <TableHeader className="max-md:sr-only">
              <TableRow className="bg-muted/50 text-xs hover:bg-muted/50 [&>th]:font-medium [&>th]:text-muted-foreground">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="max-md:block">
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

/** Placeholder rows in the shape of the users table. */
function UsersTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <SkeletonRegion label="Loading users…">
      <div className="hidden h-10 items-center gap-6 border-b bg-muted/50 px-4 md:flex">
        <Skeleton className="h-3 w-12" />
      </div>
      <ul className="divide-y">
        {Array.from({ length: rows }, (_, index) => (
          <li
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_5rem_6rem_10rem] md:gap-x-6"
          >
            <Skeleton className="h-4" style={{ width: `${45 + ((index * 17) % 35)}%` }} />
            <Skeleton className="col-span-2 row-start-2 h-3.5 w-3/5 md:col-span-1 md:row-start-auto" />
            <Skeleton className="row-start-3 h-3.5 w-12 md:row-start-auto" />
            <Skeleton className="col-start-2 row-start-1 h-5 w-14 justify-self-end rounded-md md:col-start-auto md:row-start-auto md:justify-self-start" />
            <Skeleton className="col-start-2 row-start-3 h-7 w-24 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}
