import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { acceptInviteInputSchema } from '@helpdesk/shared';
import { acceptInvite, fetchInvite } from '@/api/users';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get('password');
    if (password !== form.get('confirmPassword')) {
      setValidationError('Passwords do not match');
      return;
    }
    const parsed = acceptInviteInputSchema.safeParse({ password });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Check the form and try again');
      return;
    }
    setValidationError(null);
    accept.mutate(parsed.data.password);
  }

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
    const error = validationError ?? accept.error?.message;
    content = (
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
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
          <Input id="password" name="password" type="password" autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
          />
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
