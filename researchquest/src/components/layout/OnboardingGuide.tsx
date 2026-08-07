import { useCallback, useState } from "react";
import { Compass, NotebookPen, Target, X } from "lucide-react";
import { Button } from "../ui/button";

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

  const currentStep = STEPS[stepIndex];

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "true");
    }
  }, [storageKey]);

  const nextStep = useCallback(() => {
    setStepIndex((prev) => (prev + 1) % STEPS.length);
  }, []);

  const previousStep = useCallback(() => {
    setStepIndex((prev) => (prev - 1 + STEPS.length) % STEPS.length);
  }, []);

  if (!currentStep) return null;

  if (dismissed) {
    return null;
  }

  const isLastStep = stepIndex === STEPS.length - 1;
  const Icon = currentStep.icon;

  return (
    <section className="mb-4 rounded-surface border border-border-moderate bg-bg-surface shadow-sm">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div className="flex-shrink-0 rounded-xl bg-primary-500/10 p-3 text-primary-600">
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-primary-500">
                Welcome to ResearchQuest
              </p>
              <h2 className="text-body-lg font-semibold text-text-primary">
                {currentStep.title}
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="shrink-0 rounded-full text-text-tertiary hover:bg-bg-base hover:text-text-primary"
              aria-label="Dismiss onboarding guide"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="text-small text-text-secondary">
            {currentStep.description}
          </p>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {STEPS.map((_, index) => (
                <span
                  key={index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === stepIndex ? "bg-primary-500" : "bg-border-subtle"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={previousStep}
                disabled={stepIndex === 0}
                aria-label="Previous onboarding tip"
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={isLastStep ? handleDismiss : nextStep}
                aria-label={isLastStep ? "Complete onboarding" : "Next onboarding tip"}
              >
                {isLastStep ? "Done" : "Next tip"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
