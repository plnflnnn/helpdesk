import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { User } from '@helpdesk/shared';
import { setUserActive, usersQueryKey } from '@/api/users';
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

type DeactivateDialogProps = {
  /** The user to confirm deactivating; null keeps the dialog closed. */
  user: User | null;
  onClose: () => void;
};

export function DeactivateDialog({ user, onClose }: DeactivateDialogProps) {
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
