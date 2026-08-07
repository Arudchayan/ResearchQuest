/**
 * Showcase — dev/test-only primitive state catalog.
 *
 * Renders every shared UI primitive in all available variants, sizes, and
 * states so visual regressions and accessibility gaps can be caught before
 * they reach production.
 *
 * **Contract:**
 * - Only loaded when `import.meta.env.DEV` is `true` (tree-shaken in prod).
 * - Every interactive / visual element carries a stable `data-testid`
 *   attribute for Playwright selection.
 * - No imports from production-only modules.
 */
import { useState, type FormEvent } from "react";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormDialog } from "@/components/ui/FormDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  NoteCardSkeleton,
  PaperCardSkeleton,
  IdeaCardSkeleton,
  TaskCardSkeleton,
  ListSkeleton,
  AppLoadingSkeleton,
  SidebarSkeleton,
  SearchResultSkeleton,
  EmptyStateSkeleton,
} from "@/components/ui/Skeleton";
import { ErrorFallback, InlineError, NetworkError } from "@/components/ui/ErrorFallback";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  Info,
  Loader2,
  Plus,
  Search,
  Settings,
  Star,
  User,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section data-testid={`showcase-section-${testId}`} className="mb-12">
      <h2
        data-testid={`showcase-section-title-${testId}`}
        className="text-subtitle font-serif font-bold mb-4 pb-2 border-b border-border-subtle"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={`showcase-subsection-${testId}`} className="mb-6">
      <h3
        data-testid={`showcase-subsection-title-${testId}`}
        className="text-small font-semibold text-text-secondary uppercase tracking-wider mb-3"
      >
        {title}
      </h3>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

const showcaseBadgeExamples: readonly {
  readonly variant: BadgeVariant;
  readonly label: string;
}[] = [
  { variant: "neutral", label: "Neutral" },
  { variant: "stage-seed", label: "Seed" },
  { variant: "stage-developing", label: "Developing" },
  { variant: "stage-supported", label: "Supported" },
  { variant: "stage-mature", label: "Mature" },
  { variant: "priority-high", label: "High priority" },
  { variant: "priority-medium", label: "Medium priority" },
  { variant: "priority-low", label: "Low priority" },
  { variant: "priority-overdue", label: "Overdue" },
  { variant: "success", label: "Success" },
  { variant: "warning", label: "Warning" },
  { variant: "purple", label: "Purple" },
  { variant: "destructive", label: "Destructive" },
];

// ---------------------------------------------------------------------------
// Showcase component
// ---------------------------------------------------------------------------

export default function Showcase() {
  // -- Dialog state ---------------------------------------------------------
  const [confirmDangerOpen, setConfirmDangerOpen] = useState(false);
  const [confirmWarningOpen, setConfirmWarningOpen] = useState(false);
  const [confirmInfoOpen, setConfirmInfoOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  const handleConfirm = () => {
    setConfirmLoading(true);
    setTimeout(() => {
      setConfirmLoading(false);
      setConfirmDangerOpen(false);
    }, 1500);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormDialogOpen(false);
  };

  // -- Sample error for ErrorFallback ---------------------------------------
  const sampleError = new Error("Network request failed with status 500");

  return (
    <div
      data-testid="showcase-page"
      className="min-h-screen bg-bg-base text-text-primary"
    >
      {/* Header */}
      <header
        data-testid="showcase-header"
        className="sticky top-0 z-40 bg-bg-base/95 border-b border-border-subtle px-4 py-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-title font-serif font-bold">
            <span className="text-primary-500">◆</span> UI Showcase
            <span className="text-text-tertiary text-body font-sans font-normal ml-3">
              dev/test catalog
            </span>
          </h1>
          <span
            data-testid="showcase-env-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-bg text-purple text-caption font-semibold"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-purple" />
            DEV MODE
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* ================================================================= */}
        {/* 1. TYPOGRAPHY SCALE                                               */}
        {/* ================================================================= */}
        <Section title="Typography Scale" testId="typography">
          <div
            data-testid="showcase-typography-list"
            className="space-y-3 p-4 rounded-xl bg-bg-surface border border-border-subtle"
          >
            <p data-testid="showcase-text-hero" className="text-hero font-serif">
               Hero — The quick <span className="whitespace-nowrap">brown fox</span>
            </p>
            <p data-testid="showcase-text-title" className="text-title font-serif">
              Title — The quick brown fox
            </p>
            <p data-testid="showcase-text-subtitle" className="text-subtitle font-serif">
              Subtitle — The quick brown fox
            </p>
            <p data-testid="showcase-text-body-lg" className="text-body-lg">
              Body Large — The quick brown fox jumps over the lazy dog. Body copy
              for lead paragraphs and intros.
            </p>
            <p data-testid="showcase-text-body" className="text-body">
              Body — The quick brown fox jumps over the lazy dog. This is the
              standard body text used throughout the application.
            </p>
            <p data-testid="showcase-text-small" className="text-small">
              Small — The quick brown fox jumps over the lazy dog. Supporting UI
              text.
            </p>
            <p data-testid="showcase-text-caption" className="text-caption">
              Caption — The quick brown fox jumps over the lazy dog. Metadata and
              captions.
            </p>
            <code
              data-testid="showcase-text-code"
              className="text-code block bg-bg-elevated p-3 rounded-md"
            >
              const answer: number = 42; // Code block
            </code>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 2. SURFACE VARIANTS                                              */}
        {/* ================================================================= */}
        <Section title="Surface Variants" testId="surfaces">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div
              data-testid="showcase-surface-base"
              className="p-6 rounded-xl bg-bg-base border border-border-subtle text-center text-small font-medium text-text-secondary"
            >
              bg-base
            </div>
            <div
              data-testid="showcase-surface-surface"
              className="p-6 rounded-xl bg-bg-surface border border-border-subtle text-center text-small font-medium text-text-secondary"
            >
              bg-surface
            </div>
            <div
              data-testid="showcase-surface-elevated"
              className="p-6 rounded-xl bg-bg-elevated border border-border-subtle text-center text-small font-medium text-text-secondary"
            >
              bg-elevated
            </div>
            <div
              data-testid="showcase-surface-layer3"
              className="p-6 rounded-xl bg-bg-layer-3 border border-border-subtle text-center text-small font-medium text-text-secondary"
            >
              bg-layer-3
            </div>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 3. FEEDBACK / SEMANTIC VARIANTS                                  */}
        {/* ================================================================= */}
        <Section title="Feedback & Semantic Variants" testId="feedback">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              data-testid="showcase-feedback-success"
              className="p-4 rounded-xl bg-success-bg border border-success text-success text-small font-medium"
            >
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4" aria-hidden="true" />
                <span className="font-semibold">Success</span>
              </div>
              Operation completed successfully.
            </div>
            <div
              data-testid="showcase-feedback-warning"
              className="p-4 rounded-xl bg-warning-bg border border-warning text-warning text-small font-medium"
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                <span className="font-semibold">Warning</span>
              </div>
              This action cannot be undone.
            </div>
            <div
              data-testid="showcase-feedback-purple"
              className="p-4 rounded-xl bg-purple-bg border border-purple text-purple text-small font-medium"
            >
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4" aria-hidden="true" />
                <span className="font-semibold">Info / Accent</span>
              </div>
              New update available.
            </div>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 4. BUTTONS                                                        */}
        {/* ================================================================= */}
        <Section title="Buttons" testId="buttons">
          {/* --- Variants --- */}
          <SubSection title="Variants" testId="button-variants">
            {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map(
              (variant) => (
                <Button
                  key={variant}
                  variant={variant}
                  data-testid={`showcase-button-${variant}`}
                >
                  {variant.charAt(0).toUpperCase() + variant.slice(1)}
                </Button>
              ),
            )}
          </SubSection>

          {/* --- Sizes --- */}
          <SubSection title="Sizes" testId="button-sizes">
            {(["default", "sm", "lg", "icon"] as const).map((size) => (
              <Button
                key={size}
                size={size}
                data-testid={`showcase-button-size-${size}`}
              >
                {size === "icon" ? <Star className="w-4 h-4" aria-hidden="true" /> : size === "lg" ? "Large Button" : size === "sm" ? "Small" : "Default"}
              </Button>
            ))}
          </SubSection>

          {/* --- Disabled --- */}
          <SubSection title="Disabled" testId="button-disabled">
            {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map(
              (variant) => (
                <Button
                  key={variant}
                  variant={variant}
                  disabled
                  data-testid={`showcase-button-disabled-${variant}`}
                >
                  {variant.charAt(0).toUpperCase() + variant.slice(1)}
                </Button>
              ),
            )}
          </SubSection>

          {/* --- With icons --- */}
          <SubSection title="With Icons" testId="button-icons">
            <Button data-testid="showcase-button-icon-leading">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Item
            </Button>
            <Button variant="secondary" data-testid="showcase-button-icon-trailing">
              Next
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" data-testid="showcase-button-icon-only" aria-label="Settings">
              <Settings className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" data-testid="showcase-button-loading" disabled>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Saving…
            </Button>
          </SubSection>
        </Section>

        {/* ================================================================= */}
        {/* 5. VIEW PRIMITIVES                                                */}
        {/* ================================================================= */}
        <Section title="View Primitives" testId="view-primitives">
          <div data-testid="showcase-page-header" className="space-y-4">
            <p className="text-caption font-medium text-text-tertiary">
              Page header with responsive actions
            </p>
             <PageHeader
               data-testid="showcase-page-header-default"
               headingLevel={2}
               title="Research Library"
              description="A calm home for the sources and questions shaping your next contribution."
              actions={
                <div
                  data-testid="showcase-page-header-actions"
                  className="flex flex-wrap items-center gap-2"
                >
                  <Button
                    variant="outline"
                    data-testid="showcase-page-header-secondary-action"
                  >
                    Review queue
                  </Button>
                  <Button data-testid="showcase-page-header-primary-action">
                    Start focus
                  </Button>
                </div>
              }
            />
          </div>

          <SubSection title="Badge variants" testId="badge-variants">
            {showcaseBadgeExamples.map(({ variant, label }) => (
              <Badge
                key={variant}
                variant={variant}
                data-testid={`showcase-badge-${variant}`}
              >
                {label}
              </Badge>
            ))}
          </SubSection>

          <div data-testid="showcase-empty-state" className="border border-border-subtle rounded-surface bg-bg-surface">
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No matching papers"
              description="Try a different search term or add a new paper to your library."
              action={
                <Button data-testid="showcase-empty-state-action">
                  Add paper
                </Button>
              }
            />
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 6. CARD                                                           */}
        {/* ================================================================= */}
        <Section title="Card" testId="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card data-testid="showcase-card-default">
              <CardHeader>
                <CardTitle data-testid="showcase-card-title">Card Title</CardTitle>
                <CardDescription data-testid="showcase-card-description">
                  A description that provides additional context for the card
                  content below.
                </CardDescription>
              </CardHeader>
              <CardContent data-testid="showcase-card-content">
                <p className="text-body text-text-secondary">
                  This is the main card body content area. It can contain text,
                  forms, or other components.
                </p>
              </CardContent>
              <CardFooter data-testid="showcase-card-footer" className="flex justify-between">
                <Button variant="ghost" size="sm" data-testid="showcase-card-action-secondary">
                  Cancel
                </Button>
                <Button size="sm" data-testid="showcase-card-action-primary">
                  Continue
                </Button>
              </CardFooter>
            </Card>

            <Card data-testid="showcase-card-minimal">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-500 text-bg-base flex items-center justify-center font-bold text-small">
                    RQ
                  </div>
                  <div>
                    <p
                      data-testid="showcase-card-minimal-title"
                      className="font-semibold text-text-primary"
                    >
                      Minimal Card
                    </p>
                    <p
                      data-testid="showcase-card-minimal-desc"
                      className="text-caption text-text-tertiary"
                    >
                      Content-only variant
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 7. INPUT                                                          */}
        {/* ================================================================= */}
        <Section title="Input" testId="input">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="showcase-input-default" className="text-caption text-text-tertiary mb-1.5 block">
                Default
              </Label>
              <Input
                id="showcase-input-default"
                data-testid="showcase-input-default"
                placeholder="Placeholder text"
              />
            </div>
            <div>
              <Label htmlFor="showcase-input-value" className="text-caption text-text-tertiary mb-1.5 block">
                With Value
              </Label>
              <Input
                id="showcase-input-value"
                data-testid="showcase-input-value"
                defaultValue="Typed content"
              />
            </div>
            <div>
              <Label htmlFor="showcase-input-disabled" className="text-caption text-text-tertiary mb-1.5 block">
                Disabled
              </Label>
              <Input
                id="showcase-input-disabled"
                data-testid="showcase-input-disabled"
                disabled
                defaultValue="Disabled value"
              />
            </div>
            <div>
              <Label htmlFor="showcase-input-focused" className="text-caption text-text-tertiary mb-1.5 block">
                Focused
              </Label>
              <Input
                id="showcase-input-focused"
                data-testid="showcase-input-focused"
                defaultValue="Focused state"
                // autoFocus helps browsers show focus ring immediately
                autoFocus
              />
            </div>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 8. FORM CONTROLS (Label + Input)                                  */}
        {/* ================================================================= */}
        <Section title="Form Controls" testId="form-controls">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div
              data-testid="showcase-form-control-default"
              className="space-y-2 p-4 rounded-xl bg-bg-surface border border-border-subtle"
            >
              <Label htmlFor="showcase-form-name">Full Name</Label>
              <Input id="showcase-form-name" placeholder="Jane Doe" />
              <p className="text-caption text-text-tertiary">
                We&apos;ll never share your name.
              </p>
            </div>

            <div
              data-testid="showcase-form-control-disabled"
              className="space-y-2 p-4 rounded-xl bg-bg-surface border border-border-subtle"
            >
              <Label htmlFor="showcase-form-email" className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email (disabled)
              </Label>
              <Input
                id="showcase-form-email"
                disabled
                defaultValue="user@example.com"
                className="peer"
              />
              <p className="text-caption text-text-tertiary">Account email cannot be changed.</p>
            </div>

            <div
              data-testid="showcase-form-control-search"
              className="space-y-2 p-4 rounded-xl bg-bg-surface border border-border-subtle"
            >
              <Label htmlFor="showcase-form-search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" aria-hidden="true" />
                <Input id="showcase-form-search" placeholder="Search papers…" className="pl-9" />
              </div>
            </div>

            <div
              data-testid="showcase-form-control-with-button"
              className="space-y-2 p-4 rounded-xl bg-bg-surface border border-border-subtle"
            >
              <Label htmlFor="showcase-form-invite">Invite collaborator</Label>
              <div className="flex gap-2">
                <Input id="showcase-form-invite" placeholder="email@example.com" className="flex-1" />
                <Button size="sm" data-testid="showcase-form-invite-button">Send</Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 9. TOOLTIP                                                        */}
        {/* ================================================================= */}
        <Section title="Tooltip" testId="tooltip">
          <TooltipProvider>
            <div
              data-testid="showcase-tooltip-group"
              className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-bg-surface border border-border-subtle"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" data-testid="showcase-tooltip-top">
                    <Info className="w-4 h-4" aria-hidden="true" />
                    Hover me (top)
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" data-testid="showcase-tooltip-top-content">
                  <p>Helpful information</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" data-testid="showcase-tooltip-right">
                    <User className="w-4 h-4" aria-hidden="true" />
                    Hover me (right)
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" data-testid="showcase-tooltip-right-content">
                  <p>User profile settings</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="showcase-tooltip-icon" aria-label="Notifications">
                    <Bell className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent data-testid="showcase-tooltip-icon-content">
                  <p>3 unread notifications</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </Section>

        {/* ================================================================= */}
        {/* 10. DIALOGS                                                       */}
        {/* ================================================================= */}
        <Section title="Dialogs" testId="dialogs">
          <div
            data-testid="showcase-dialog-buttons"
            className="flex flex-wrap items-start gap-4"
          >
            <Button
              variant="destructive"
              data-testid="showcase-dialog-open-danger"
              onClick={() => setConfirmDangerOpen(true)}
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              Danger Confirm
            </Button>
            <Button
              variant="outline"
              data-testid="showcase-dialog-open-warning"
              onClick={() => setConfirmWarningOpen(true)}
            >
              Warning Confirm
            </Button>
            <Button
              variant="secondary"
              data-testid="showcase-dialog-open-info"
              onClick={() => setConfirmInfoOpen(true)}
            >
              Info Confirm
            </Button>
            <Button
              data-testid="showcase-dialog-open-form"
              onClick={() => setFormDialogOpen(true)}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Form Dialog
            </Button>
          </div>

          {/* Danger Confirm */}
          <ConfirmDialog
            isOpen={confirmDangerOpen}
            onClose={() => setConfirmDangerOpen(false)}
            onConfirm={handleConfirm}
            title="Delete Project"
            message="This action permanently removes the project and all associated data. This cannot be undone."
            confirmText="Delete"
            variant="danger"
            isLoading={confirmLoading}
          />

          {/* Warning Confirm */}
          <ConfirmDialog
            isOpen={confirmWarningOpen}
            onClose={() => setConfirmWarningOpen(false)}
            onConfirm={() => setConfirmWarningOpen(false)}
            title="Unsaved Changes"
            message="You have unsaved changes that will be lost if you navigate away."
            confirmText="Discard"
            cancelText="Keep Editing"
            variant="warning"
          />

          {/* Info Confirm */}
          <ConfirmDialog
            isOpen={confirmInfoOpen}
            onClose={() => setConfirmInfoOpen(false)}
            onConfirm={() => setConfirmInfoOpen(false)}
            title="Confirm Action"
            message="Are you sure you want to proceed with this action?"
            confirmText="Proceed"
            variant="info"
          />

          {/* Form Dialog */}
          <FormDialog
            isOpen={formDialogOpen}
            onClose={() => setFormDialogOpen(false)}
            onSubmit={handleFormSubmit}
            title="Create New Paper"
            description="Enter the details for the new research paper."
            submitText="Create"
            icon={<BookIcon />}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="showcase-dialog-title">Title</Label>
                  <Input
                    id="showcase-dialog-title"
                    data-testid="showcase-dialog-first-input"
                    placeholder="Paper title"
                  />
              </div>
              <div className="space-y-2">
                <Label htmlFor="showcase-dialog-authors">Authors</Label>
                <Input id="showcase-dialog-authors" placeholder="Author names (comma separated)" />
              </div>
            </div>
          </FormDialog>
        </Section>

        {/* ================================================================= */}
        {/* 11. SKELETON / LOADING STATES                                     */}
        {/* ================================================================= */}
        <Section title="Skeleton / Loading States" testId="skeleton">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div data-testid="showcase-skeleton-base" className="space-y-3 p-4 rounded-xl bg-bg-surface border border-border-subtle">
              <p className="text-caption font-medium text-text-tertiary mb-2">Base Skeleton</p>
              <Skeleton className="h-4 w-3/4" data-testid="showcase-skeleton-base-line1" />
              <Skeleton className="h-4 w-full" data-testid="showcase-skeleton-base-line2" />
              <Skeleton className="h-4 w-5/6" data-testid="showcase-skeleton-base-line3" />
              <Skeleton className="h-20 w-full rounded-md" data-testid="showcase-skeleton-base-block" />
            </div>

            <div data-testid="showcase-skeleton-notecard">
              <NoteCardSkeleton />
            </div>
            <div data-testid="showcase-skeleton-papercard">
              <PaperCardSkeleton />
            </div>
            <div data-testid="showcase-skeleton-ideacard">
              <IdeaCardSkeleton />
            </div>
            <div data-testid="showcase-skeleton-taskcard">
              <TaskCardSkeleton />
            </div>
            <div data-testid="showcase-skeleton-list">
              <p className="text-caption font-medium text-text-tertiary mb-2">List Skeleton</p>
              <ListSkeleton count={3} itemType="note" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div data-testid="showcase-skeleton-sidebar">
              <p className="text-caption font-medium text-text-tertiary mb-2">Sidebar Skeleton</p>
              <SidebarSkeleton />
            </div>
            <div data-testid="showcase-skeleton-searchresult">
              <p className="text-caption font-medium text-text-tertiary mb-2">Search Result Skeleton</p>
              <SearchResultSkeleton />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div data-testid="showcase-skeleton-emptystate">
              <p className="text-caption font-medium text-text-tertiary mb-2">Empty State Skeleton</p>
              <EmptyStateSkeleton />
            </div>
            <div data-testid="showcase-skeleton-apploading">
              <p className="text-caption font-medium text-text-tertiary mb-2">App Loading Skeleton (compact)</p>
              <div className="max-w-md mx-auto border border-border-subtle rounded-xl overflow-hidden">
                 <AppLoadingSkeleton className="min-h-0 h-64" />
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 12. ERROR / FEEDBACK COMPONENTS                                   */}
        {/* ================================================================= */}
        <Section title="Error Fallback & Feedback" testId="errors">
          <div className="space-y-6">
            <div data-testid="showcase-error-inline">
              <p className="text-caption font-medium text-text-tertiary mb-2">Inline Error</p>
              <InlineError
                message="Failed to load research papers. Please check your connection."
                onRetry={() => {}}
              />
            </div>

            <div data-testid="showcase-error-network">
              <p className="text-caption font-medium text-text-tertiary mb-2">Network Error</p>
              <div className="max-w-sm border border-border-subtle rounded-xl overflow-hidden">
                <NetworkError onRetry={() => {}} />
              </div>
            </div>

            <div data-testid="showcase-error-fallback">
              <p className="text-caption font-medium text-text-tertiary mb-2">Error Fallback (full page)</p>
              <div className="border border-border-subtle rounded-xl overflow-hidden">
                <ErrorFallback
                  error={sampleError}
                  resetError={() => {}}
                  title="Failed to Load Data"
                  showHomeButton
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ================================================================= */}
        {/* 13. NOT FOUND                                                     */}
        {/* ================================================================= */}
        <Section title="Not Found / Empty" testId="not-found">
          <div
            data-testid="showcase-notfound-card"
            className="p-8 rounded-xl bg-bg-surface border border-border-subtle text-center"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-control bg-warning-bg mb-4">
              <AlertTriangle className="w-6 h-6 text-warning" aria-hidden="true" />
            </div>
            <h3
              data-testid="showcase-notfound-title"
               className="text-subtitle font-serif font-semibold text-text-primary mb-2"
            >
              Item Not Found
            </h3>
            <p
              data-testid="showcase-notfound-message"
              className="text-body text-text-secondary mb-6 max-w-sm mx-auto"
            >
              The item you&apos;re looking for doesn&apos;t exist or has been
              deleted.
            </p>
            <Button variant="outline" data-testid="showcase-notfound-back">
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
              Back to List
            </Button>
          </div>
        </Section>
      </div>

      {/* Footer */}
      <footer
        data-testid="showcase-footer"
        className="border-t border-border-subtle px-4 py-4 text-center text-caption text-text-tertiary sm:px-6 lg:px-8"
      >
        ResearchQuest UI Showcase &mdash; Dev build only &bull;{" "}
        {new Date().toLocaleDateString()}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small icon wrappers
// ---------------------------------------------------------------------------

function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6 text-primary-500"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
}
