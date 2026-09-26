import { beforeEach, describe, expect, it } from "vitest";
import { useTopicKindStore } from "../../store/topicKindStore";

describe("topicKindStore", () => {
  beforeEach(() => {
    useTopicKindStore.setState({ kinds: {} });
  });

  it("defaults to research and remembers area/subject kinds", () => {
    expect(useTopicKindStore.getState().kindOf("t1")).toBe("research");
    useTopicKindStore.getState().setKind("t1", "area");
    useTopicKindStore.getState().setKind("t2", "subject");
    expect(useTopicKindStore.getState().kindOf("t1")).toBe("area");
    expect(useTopicKindStore.getState().kindOf("t2")).toBe("subject");
  });
});
