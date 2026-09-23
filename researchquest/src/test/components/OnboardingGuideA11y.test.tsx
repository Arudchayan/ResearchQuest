import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { OnboardingGuide } from "../../components/layout/OnboardingGuide";
import {
  completeOnboardingTip,
  tipForView,
  useOnboardingTipsStore,
} from "../../store/onboardingTipsStore";

const STORAGE_KEY = "rq_test_onboarding_pr12";

function renderGuide() {
  return render(<OnboardingGuide storageKey={STORAGE_KEY} />);
}

describe("OnboardingGuide accessibility", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("exposes a named landmark region", () => {
    renderGuide();
    expect(
      screen.getByRole("region", { name: "Onboarding guide" }),
    ).toBeInTheDocument();
  });

  it("announces the current step position to screen readers", () => {
    renderGuide();
    expect(screen.getByText("Step 1 of 3: Capture quickly")).toHaveClass(
      "sr-only",
    );
  });

  it("hides the decorative progress dots from assistive technology", () => {
    const { container } = renderGuide();
    const dots = container.querySelector('div[aria-hidden="true"]');
    expect(dots).not.toBeNull();
    expect(dots?.querySelectorAll("span").length).toBe(3);
  });

  it("labels every control and disables Back on the first step", () => {
    renderGuide();
    expect(
      screen.getByRole("button", { name: "Previous onboarding tip" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next onboarding tip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dismiss onboarding guide" }),
    ).toBeInTheDocument();
  });

  it("advances the step announcement with Next and returns with Back", () => {
    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Next onboarding tip" }));
    expect(
      screen.getByText("Step 2 of 3: Link your research"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Previous onboarding tip" }),
    );
    expect(
      screen.getByText("Step 1 of 3: Capture quickly"),
    ).toBeInTheDocument();
  });

  it("dismisses via Done and persists the dismissal", () => {
    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Next onboarding tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Next onboarding tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete onboarding" }));
    expect(
      screen.queryByRole("region", { name: "Onboarding guide" }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("stays dismissed on re-mount once the storage flag is set", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    renderGuide();
    expect(
      screen.queryByRole("region", { name: "Onboarding guide" }),
    ).not.toBeInTheDocument();
  });
});

describe("OnboardingGuide contextual tips", () => {
  beforeEach(() => {
    window.localStorage.removeItem("researchquest-onboarding-tips");
    useOnboardingTipsStore.setState({ doneIds: [] });
  });

  it("shows the papers coachmark until that action is done", () => {
    const { rerender } = render(
      <OnboardingGuide variant="contextual" view="papers" />,
    );
    expect(
      screen.getByRole("region", { name: "Workspace tip" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Add a paper")).toBeInTheDocument();

    rerender(<OnboardingGuide variant="contextual" view="notes" />);
    expect(screen.getByText("Capture a note")).toBeInTheDocument();
    expect(screen.queryByText("Add a paper")).not.toBeInTheDocument();

    completeOnboardingTip("add-paper");
    rerender(<OnboardingGuide variant="contextual" view="papers" />);
    expect(
      screen.queryByRole("region", { name: "Workspace tip" }),
    ).not.toBeInTheDocument();
  });

  it("dismisses a contextual tip without blocking the rest of the catalog", () => {
    render(<OnboardingGuide variant="contextual" view="ideas" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss workspace tip" }),
    );
    expect(
      screen.queryByRole("region", { name: "Workspace tip" }),
    ).not.toBeInTheDocument();
    expect(tipForView("ideas")).toBeNull();
    expect(tipForView("tasks")?.id).toBe("add-task");
  });
});

