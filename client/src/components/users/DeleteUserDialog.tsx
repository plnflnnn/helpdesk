import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { User } from '@helpdesk/shared';
import { deleteUser, usersQueryKey } from '@/api/users';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

type DeleteUserDialogProps = {
  /** The user to confirm deleting; null keeps the dialog closed. */
  user: User | null;
  onClose: () => void;
};

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteUser,
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
          remove.reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user?.name}?</DialogTitle>
          <DialogDescription>
            They will be signed out everywhere, won’t be able to sign in, and will be removed from
            the users list.
          </DialogDescription>
        </DialogHeader>
        {remove.error && (
          <Alert variant="destructive">
            <AlertDescription>{remove.error.message}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => user && remove.mutate(user.id)}
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
