import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { usePapers } from "../../hooks/usePapers";
import { mockSupabaseClient, mockPaper } from "../mocks/supabase";
import { useAppStore } from "../../store/appStore";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(true),
  XP_REWARDS: {
    CREATE_PAPER: 10,
    UPDATE_PAPER_STATUS: 5,
  },
}));

const { tasksInsert, profilesUpdate } = vi.hoisted(() => ({
  tasksInsert: vi.fn(),
  profilesUpdate: vi.fn(),
}));

const createMockBuilder = (overrides: any = {}) => {
  const builder: any = {
    then: ((onFulfilled?: (value: any) => any) => {
      const result = { data: null, error: null };
      return Promise.resolve(result).then(onFulfilled);
    }) as any,
    ...overrides,
  };
  if (!builder.select) builder.select = vi.fn().mockReturnValue(builder);
  if (!builder.insert) builder.insert = vi.fn().mockReturnValue(builder);
  if (!builder.update) builder.update = vi.fn().mockReturnValue(builder);
  if (!builder.eq) builder.eq = vi.fn().mockReturnValue(builder);
  if (!builder.single)
    builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  return builder;
};

describe("usePapers auto reading tasks (PR19 item 79)", () => {
  const newPaper = { ...mockPaper, id: "new-paper-id", title: "New Paper" };
  let autoCreateEnabled = true;

  const setupSupabaseMock = () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return createMockBuilder({
          single: vi.fn().mockResolvedValue({
            data: { auto_create_reading_tasks: autoCreateEnabled },
            error: null,
          }),
          update: profilesUpdate.mockReturnValue(
            createMockBuilder({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          ),
        });
      }
      if (table === "tasks") {
        return createMockBuilder({ insert: tasksInsert });
      }
      return createMockBuilder({
        insert: vi.fn().mockReturnValue(
          createMockBuilder({
            select: vi.fn().mockReturnValue(
              createMockBuilder({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: newPaper, error: null }),
              }),
            ),
          }),
        ),
      });
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    autoCreateEnabled = true;
    tasksInsert.mockResolvedValue({ error: null });
    useAppStore.setState({ papers: [], papersLoading: false });
    setupSupabaseMock();
  });

  const createPaper = async () => {
    const { result } = renderHook(() => usePapers("test-user-id"));
    return result.current.createPaper({
      title: "New Paper",
      authors: ["Author"],
    });
  };

  it("links the auto-created reading task to its paper", async () => {
    await createPaper();

    expect(tasksInsert).toHaveBeenCalledTimes(1);
    expect(tasksInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        paper_id: "new-paper-id",
        title: expect.stringContaining("Read:"),
      }),
    );
  });

  it("offers an inline opt-out action on the reading-task toast", async () => {
    await createPaper();

    const call = vi
      .mocked(toast.success)
      .mock.calls.find((args) => args[0] === "Reading task created");
    expect(call).toBeDefined();
    const options = call![1] as {
      action: { label: string; onClick: () => void };
    };
    expect(options.action.label).toBe("Turn off auto-tasks");

    await options.action.onClick();

    expect(profilesUpdate).toHaveBeenCalledWith({
      auto_create_reading_tasks: false,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Auto reading tasks turned off",
      expect.anything(),
    );
  });

  it("skips the reading task when the user opted out", async () => {
    autoCreateEnabled = false;

    await createPaper();

    expect(tasksInsert).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith(
      "Reading task created",
      expect.anything(),
    );
  });

  it("falls back to an unlinked insert when tasks.paper_id is missing", async () => {
    tasksInsert
      .mockResolvedValueOnce({
        error: { code: "42703", message: 'column "paper_id" does not exist' },
      })
      .mockResolvedValueOnce({ error: null });

    await createPaper();

    // The reading-task chain is detached from createPaper; the retry adds an
    // extra await tick, so wait for the chain to settle instead of asserting
    // synchronously.
    await waitFor(() => {
      expect(tasksInsert).toHaveBeenCalledTimes(2);
    });
    expect(tasksInsert.mock.calls[1][0]).not.toHaveProperty("paper_id");
    expect(toast.success).toHaveBeenCalledWith(
      "Reading task created",
      expect.anything(),
    );
  });
});
