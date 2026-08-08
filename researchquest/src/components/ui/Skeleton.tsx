import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base skeleton component for loading states
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "shimmer rounded-lg bg-bg-elevated",
        className,
      )}
      aria-label="Loading..."
      role="status"
      {...props}
    />
  );
}

/**
 * Skeleton for note cards in the sidebar
 */
export function NoteCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-border-subtle bg-bg-surface p-3 shadow-card space-y-2"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 flex-shrink-0" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-3 mt-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for paper cards in the sidebar
 */
export function PaperCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-border-subtle bg-bg-surface p-3 shadow-card space-y-2"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 flex-shrink-0" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-3 w-3/5" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/**
 * Skeleton for idea cards in the sidebar
 */
export function IdeaCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-border-subtle bg-bg-surface p-3 shadow-card space-y-2"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 flex-shrink-0" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for task items
 */
export function TaskCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-card space-y-2"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="w-5 h-5 rounded flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the markdown editor
 */
export function EditorSkeleton() {
  return (
    <div
      className="h-screen-dynamic flex flex-col bg-bg-base"
      role="status"
      aria-label="Loading editor..."
    >
      <div aria-hidden="true" className="flex flex-col h-full">
        {/* Title Bar */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-6 w-20" />
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-bg-elevated border-b border-border-subtle flex items-center gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-md" />
          ))}
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Pane */}
          <div className="w-3/5 p-6 space-y-4 bg-bg-surface">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
            <div className="pt-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Preview Pane */}
          <div className="w-2/5 p-6 space-y-4 bg-bg-base border-l border-border-subtle">
            <Skeleton className="h-6 w-1/2 mb-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-5/6" />
            <div className="pt-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for list containers (shows multiple item skeletons)
 */
interface ListSkeletonProps {
  count?: number;
  itemType?: "note" | "paper" | "idea" | "task";
}

export function ListSkeleton({
  count = 5,
  itemType = "note",
}: ListSkeletonProps) {
  const SkeletonComponent = {
    note: NoteCardSkeleton,
    paper: PaperCardSkeleton,
    idea: IdeaCardSkeleton,
    task: TaskCardSkeleton,
  }[itemType];

  return (
    <div
      className="space-y-2"
      role="status"
      aria-label={`Loading ${itemType}s...`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for the app loading state
 */
export function AppLoadingSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-bg-base"
      role="status"
      aria-label="Loading application..."
    >
      <div className="text-center" aria-hidden="true">
        {/* Logo */}
        <div className="w-16 h-16 bg-primary-500 rounded-lg mx-auto mb-6 flex items-center justify-center text-white font-bold text-2xl animate-pulse">
          RQ
        </div>

        {/* Loading Text */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-48 mx-auto" />
          <Skeleton className="h-3 w-32 mx-auto" />
        </div>

        {/* Spinner */}
        <div className="mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the sidebar section
 */
export function SidebarSkeleton() {
  return (
    <div
      className="p-4 space-y-4"
      role="status"
      aria-label="Loading sidebar..."
    >
      <div aria-hidden="true" className="space-y-4">
        {/* Navigation Tabs */}
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>

        {/* Search Bar */}
        <Skeleton className="h-10 w-full rounded-md" />

        {/* Add Button */}
        <Skeleton className="h-10 w-full rounded-md" />

        {/* List Header */}
        <Skeleton className="h-4 w-32" />

        {/* List Items */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for search results
 */
export function SearchResultSkeleton() {
  return (
    <div
      className="p-4 space-y-2 border-b border-border-subtle last:border-b-0"
      role="status"
      aria-label="Loading search result..."
    >
      <div aria-hidden="true" className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for empty state (minimal animation)
 */
export function EmptyStateSkeleton() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      role="status"
      aria-label="Loading content..."
    >
      <div aria-hidden="true" className="flex flex-col items-center">
        <Skeleton className="w-16 h-16 rounded-full mb-4" />
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
