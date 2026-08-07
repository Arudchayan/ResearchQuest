import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = Omit<
  ComponentPropsWithoutRef<"header">,
  "children" | "title"
> & {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly headingLevel?: 1 | 2 | 3;
};

const headingTags = {
  1: "h1",
  2: "h2",
  3: "h3",
} as const;

export function PageHeader({
  title,
  description,
  actions,
  headingLevel = 1,
  className,
  ...props
}: PageHeaderProps) {
  const Heading = headingTags[headingLevel];

  return (
    <header
      {...props}
      className={cn(
        "flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle p-4 sm:p-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Heading className="font-serif text-title font-bold tracking-tight text-text-primary">
          {title}
        </Heading>
        {description !== undefined ? (
          <p className="mt-2 text-body text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
