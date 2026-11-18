import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[1.75rem] font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">Check the address, or start again from the dashboard.</p>
      <Link
        to="/"
        className="w-fit rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Go to the dashboard
      </Link>
    </div>
  );
}
