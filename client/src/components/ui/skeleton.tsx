import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A grey placeholder block shown while content loads. Stops pulsing for reduced motion. */
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'animate-pulse rounded-md bg-foreground/[0.08] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/** Wraps skeletons so screen readers hear one loading message instead of nothing. */
function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export { Skeleton, SkeletonRegion };
