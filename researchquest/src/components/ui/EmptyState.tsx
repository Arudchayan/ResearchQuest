import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      {...props}
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-6 text-center",
        className,
      )}
    >
      {icon !== undefined ? (
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-control bg-bg-elevated text-text-tertiary"
        >
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-body-lg font-semibold text-text-primary">
          {title}
        </h2>
        <p className="text-body text-text-secondary">{description}</p>
      </div>
      {action !== undefined ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}
