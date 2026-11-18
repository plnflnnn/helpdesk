import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: ReactNode;
  /** A line under the title. */
  description?: ReactNode;
  /** Buttons on the right (below the title on phones). */
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight md:text-[2rem]">
          {title}
        </h1>
        {description && <p className="text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
