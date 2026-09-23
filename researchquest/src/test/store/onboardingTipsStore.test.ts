import { beforeEach, describe, expect, it } from "vitest";
import {
  CONTEXTUAL_TIPS,
  completeOnboardingCreate,
  completeOnboardingTip,
  tipForView,
  useOnboardingTipsStore,
} from "../../store/onboardingTipsStore";

describe("onboardingTipsStore", () => {
  beforeEach(() => {
    window.localStorage.removeItem("researchquest-onboarding-tips");
    useOnboardingTipsStore.setState({ doneIds: [] });
  });

  it("keeps a route tip pending when the view changes", () => {
    expect(tipForView("papers").id).toBe("add-paper");
    expect(tipForView("notes").id).toBe("capture-note");
    expect(useOnboardingTipsStore.getState().doneIds).toEqual([]);
  });

  it("hides a tip only after its action is completed", () => {
    completeOnboardingTip("add-paper");
    expect(tipForView("papers")).toBeNull();
    expect(tipForView("notes")?.id).toBe("capture-note");
  });

  it("treats dismiss as done so the coachmark does not return", () => {
    completeOnboardingTip("capture-note");
    completeOnboardingTip("capture-note");
    expect(useOnboardingTipsStore.getState().doneIds).toEqual(["capture-note"]);
    expect(tipForView("notes")).toBeNull();
  });

  it("completes the matching create action from a table write", () => {
    completeOnboardingCreate("papers");
    completeOnboardingCreate("unknown-table");
    expect(tipForView("papers")).toBeNull();
    expect(tipForView("tasks")?.id).toBe("add-task");
  });

  it("has no coachmark on feeds or topics (welcome owns first-run)", () => {
    expect(tipForView("feeds")).toBeNull();
    expect(tipForView("topics")).toBeNull();
    expect(CONTEXTUAL_TIPS.every((tip) => tip.title.length < 40)).toBe(true);
  });
});
