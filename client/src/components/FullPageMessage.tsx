import type { ReactNode } from 'react';

export function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-sm text-muted-foreground">
      <p role="status">{children}</p>
    </div>
  );
}
