import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
        Back to tickets
      </Link>
    </div>
  );
}
