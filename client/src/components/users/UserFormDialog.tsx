import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createUserInputSchema,
  passwordSchema,
  PASSWORD_MIN_LENGTH,
  type User,
} from '@helpdesk/shared';
import { createUser, updateUser, usersQueryKey } from '@/api/users';
import { FieldError } from '@/components/FieldError';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Creating a user: every field is required. */
const createFormSchema = createUserInputSchema.pick({ name: true, email: true, password: true });

/** Editing a user: an empty password means "keep the current one". */
const editFormSchema = createFormSchema.extend({ password: passwordSchema.or(z.literal('')) });

type UserFormValues = z.input<typeof createFormSchema>;

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user to edit. Leave it out to create a new agent. */
  user?: User;
};

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = user !== undefined;
  const queryClient = useQueryClient();
  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? editFormSchema : createFormSchema),
    values: { name: user?.name ?? '', email: user?.email ?? '', password: '' },
  });
  const save = useMutation({
    mutationFn: ({ password, ...fields }: UserFormValues) =>
      isEdit
        ? updateUser(user.id, password ? { ...fields, password } : fields)
        : createUser({ ...fields, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
      handleOpenChange(false);
    },
  });
  const { errors } = form.formState;

  function handleOpenChange(next: boolean) {
    if (!next) {
      save.reset();
      form.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((data) => save.mutate(data))}
          noValidate
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${user.name}` : 'Add agent'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Leave the password empty to keep the current one.'
                : 'Set an initial password and share it with the agent so they can sign in.'}
            </DialogDescription>
          </DialogHeader>
          {save.error && (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'user-name-error' : undefined}
              {...form.register('name')}
            />
            <FieldError id="user-name-error" error={errors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              autoComplete="off"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'user-email-error' : undefined}
              {...form.register('email')}
            />
            <FieldError id="user-email-error" error={errors.email} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-password">{isEdit ? 'New password' : 'Password'}</Label>
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'user-password-error' : 'user-password-hint'}
              {...form.register('password')}
            />
            {errors.password ? (
              <FieldError id="user-password-error" error={errors.password} />
            ) : (
              <p id="user-password-hint" className="text-xs text-muted-foreground">
                {isEdit ? 'Optional. ' : ''}At least {PASSWORD_MIN_LENGTH} characters.
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
