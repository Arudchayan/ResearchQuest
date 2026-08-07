import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "stage-seed"
  | "stage-developing"
  | "stage-supported"
  | "stage-mature"
  | "priority-high"
  | "priority-medium"
  | "priority-low"
  | "priority-overdue"
  | "success"
  | "warning"
  | "purple"
  | "destructive";

const badgeVariants = {
  neutral: "bg-bg-elevated text-text-secondary",
  "stage-seed": "bg-stage-seed-bg text-stage-seed",
  "stage-developing": "bg-stage-developing-bg text-stage-developing",
  "stage-supported": "bg-stage-supported-bg text-stage-supported",
  "stage-mature": "bg-stage-mature-bg text-stage-mature",
  "priority-high": "bg-priority-high-bg text-priority-high",
  "priority-medium": "bg-priority-medium-bg text-priority-medium",
  "priority-low": "bg-priority-low-bg text-priority-low",
  "priority-overdue": "bg-priority-overdue-bg text-priority-overdue",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  purple: "bg-purple-bg text-purple",
  destructive: "bg-destructive-bg text-destructive",
} satisfies Record<BadgeVariant, string>;

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  readonly variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-control border border-border-subtle px-2 py-0.5 text-caption font-semibold",
        badgeVariants[variant],
        className,
      )}
    />
  );
}
