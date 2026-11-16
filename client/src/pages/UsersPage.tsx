import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, UserPlusIcon } from 'lucide-react';
import { createAgentInputSchema, type UserListItem } from '@helpdesk/shared';
import { createAgent, listUsers, setUserActive } from '@/api/users';
import { useCurrentUser } from '@/auth/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const usersQueryKey = ['users'] as const;

export function UsersPage() {
  const users = useQuery({ queryKey: usersQueryKey, queryFn: listUsers });
  const [addOpen, setAddOpen] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<UserListItem | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => setAddOpen(true)}>
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
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <UserRow key={user.id} user={user} onDeactivate={() => setToDeactivate(user)} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} />
      <DeactivateDialog user={toDeactivate} onClose={() => setToDeactivate(null)} />
    </div>
  );
}

function UserRow({ user, onDeactivate }: { user: UserListItem; onDeactivate: () => void }) {
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
        {!user.active ? (
          <Badge variant="outline">Deactivated</Badge>
        ) : user.pendingInvite ? (
          <Badge variant="secondary">Invite pending</Badge>
        ) : (
          <Badge variant="secondary">Active</Badge>
        )}
      </TableCell>
      <TableCell className="pr-4 text-right">
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
      </TableCell>
    </TableRow>
  );
}

function AddAgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: createAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      create.reset();
      setValidationError(null);
      setCopied(false);
    }
    onOpenChange(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = createAgentInputSchema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Check the form and try again');
      return;
    }
    setValidationError(null);
    create.mutate(parsed.data);
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  const error = validationError ?? create.error?.message;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {create.data ? (
          <>
            <DialogHeader>
              <DialogTitle>Agent created</DialogTitle>
              <DialogDescription>
                Send this invite link to {create.data.user.name}. It works once and expires in 7
                days.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                aria-label="Invite link"
                value={create.data.inviteUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy invite link"
                onClick={() => void copyLink(create.data.inviteUrl)}
              >
                {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
              </Button>
            </div>
            <DialogFooter>
              <DialogClose render={<Button />}>Done</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Add agent</DialogTitle>
              <DialogDescription>
                The agent gets an invite link to set their own password.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input id="agent-name" name="name" autoComplete="off" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-email">Email</Label>
              <Input id="agent-email" name="email" type="email" autoComplete="off" />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create agent'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeactivateDialog({ user, onClose }: { user: UserListItem | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const deactivate = useMutation({
    mutationFn: (id: string) => setUserActive(id, false),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
      onClose();
    },
  });

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) {
          deactivate.reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {user?.name}?</DialogTitle>
          <DialogDescription>
            They will be signed out everywhere immediately and won’t be able to sign in until
            reactivated.
          </DialogDescription>
        </DialogHeader>
        {deactivate.error && (
          <Alert variant="destructive">
            <AlertDescription>{deactivate.error.message}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={deactivate.isPending}
            onClick={() => user && deactivate.mutate(user.id)}
          >
            {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
