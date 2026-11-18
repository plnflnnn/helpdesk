import { Navigate, useLocation } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginInputSchema } from '@helpdesk/shared';
import { useCurrentUser, useLogin } from '@/auth/useAuth';
import { FieldError } from '@/components/FieldError';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginPage() {
  const { data: user } = useCurrentUser();
  const login = useLogin();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Chalkboard panel: wider screens only. */}
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex lg:p-14">
        <span className="font-display text-lg font-semibold tracking-tight text-white">
          Helpdesk
        </span>
        <p className="max-w-sm font-display text-[2.5rem] leading-[1.1] font-semibold tracking-tight text-white lg:text-[3rem]">
          Every student question, answered.
        </p>
        <p className="max-w-xs text-sm text-sidebar-foreground/70">
          The AI sorts and drafts. You decide what gets sent.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <span className="font-display text-lg font-semibold tracking-tight md:hidden">
            Helpdesk
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground">
              Use the email and password for your agent account.
            </p>
          </div>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((data) => login.mutate(data))}
            noValidate
          >
            {login.error && (
              <Alert variant="destructive">
                <AlertDescription>{login.error.message}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="h-10 bg-card"
                {...register('email')}
              />
              <FieldError id="email-error" error={errors.email} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="h-10 bg-card"
                {...register('password')}
              />
              <FieldError id="password-error" error={errors.password} />
            </div>
            <Button type="submit" size="lg" className="mt-2 h-10" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
