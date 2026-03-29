import { useMemo, useState } from "react";
import { Compass, NotebookPen, Target, X } from "lucide-react";

interface OnboardingGuideProps {
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = "rq_onboarding_complete";

const STEPS = [
  {
    title: "Capture quickly",
    description:
      "Use the quick-add buttons in Notes and Ideas to capture sparks without leaving your current flow.",
    icon: NotebookPen,
  },
  {
    title: "Link your research",
    description:
      "Attach topics and papers to each note or idea so Focus Studio can suggest the best next sprint.",
    icon: Target,
  },
  {
    title: "Review the dashboard",
    description:
      "Check the left sidebar for streaks, XP boosts, and suggested next actions before diving in.",
    icon: Compass,
  },
];

export function OnboardingGuide({
  storageKey = DEFAULT_STORAGE_KEY,
}: OnboardingGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(storageKey) === "true";
  });

  const currentStep = useMemo(() => STEPS[stepIndex], [stepIndex]);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "true");
    }
  };

  const nextStep = () => {
    setStepIndex((prev) => (prev + 1) % STEPS.length);
  };

  const previousStep = () => {
    setStepIndex((prev) => (prev - 1 + STEPS.length) % STEPS.length);
  };

  const Icon = currentStep.icon;

  return (
    <section className="mb-4 rounded-2xl border border-border-subtle bg-bg-surface shadow-sm">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div className="flex-shrink-0 rounded-xl bg-primary-500/10 p-3 text-primary-600">
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">
                Welcome to ResearchQuest
              </p>
              <h2 className="text-lg font-semibold text-text-primary">
                {currentStep.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-full p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-base"
              aria-label="Dismiss onboarding guide"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-sm text-text-secondary">
            {currentStep.description}
          </p>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    index === stepIndex ? "bg-primary-500" : "bg-border-subtle"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={previousStep}
                className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                aria-label="Previous onboarding tip"
              >
                Back
              </button>
              <button
                type="button"
                onClick={nextStep}
                className="rounded-full bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
                aria-label="Next onboarding tip"
              >
                Next tip
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
