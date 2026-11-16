import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { acceptInviteInputSchema, PASSWORD_MIN_LENGTH } from '@helpdesk/shared';
import { acceptInvite, fetchInvite } from '@/api/users';
import { FieldError } from '@/components/FieldError';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const setPasswordFormSchema = acceptInviteInputSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Reached from the invite link: `/set-password?token=…`. */
export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => fetchInvite(token),
    enabled: token !== '',
  });
  const accept = useMutation({
    mutationFn: (password: string) => acceptInvite(token, password),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(setPasswordFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  let content;
  if (token === '' || invite.isError) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>
          {invite.error?.message ?? 'This invite link is invalid. Ask an admin for a new one.'}
        </AlertDescription>
      </Alert>
    );
  } else if (invite.isPending) {
    content = <p className="text-sm text-muted-foreground">Checking your invite…</p>;
  } else if (accept.isSuccess) {
    content = (
      <div className="flex flex-col gap-4">
        <p className="text-sm" role="status">
          Your password is set. You can now sign in.
        </p>
        <Link to="/login" className={buttonVariants({ size: 'lg' })}>
          Go to sign in
        </Link>
      </div>
    );
  } else {
    content = (
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(({ password }) => accept.mutate(password))}
        noValidate
      >
        {accept.error && (
          <Alert variant="destructive">
            <AlertDescription>{accept.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={invite.data.email}
            autoComplete="username"
            readOnly
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            {...register('password')}
          />
          {errors.password ? (
            <FieldError id="password-error" error={errors.password} />
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? true : undefined}
            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
            {...register('confirmPassword')}
          />
          <FieldError id="confirmPassword-error" error={errors.confirmPassword} />
        </div>
        <Button type="submit" size="lg" disabled={accept.isPending}>
          {accept.isPending ? 'Saving…' : 'Set password'}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>Set your password</h1>
          </CardTitle>
          <CardDescription>
            {invite.data ? `Welcome, ${invite.data.name}.` : 'Finish setting up your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </div>
  );
}
