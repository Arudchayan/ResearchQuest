import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { DataManagementDialog } from "../../components/settings/DataManagementDialog";
import { useAppStore } from "../../store/appStore";

// Mock dependencies
const mockExportData = vi.fn();
vi.mock("../../utils/export", () => ({
  exportData: vi.fn(async (data: unknown) => {
    mockExportData(data);
  }),
}));

// Mock Supabase
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      upsert: mockUpsert,
    }),
  },
}));

// Mock Sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("DataManagementDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      user: { id: "test-user" } as any,
      notes: [{ id: "n1" }],
      papers: [],
      ideas: [],
      topics: {},
      tasks: [],
    });
  });

  it("renders correctly when open", () => {
    render(<DataManagementDialog open={true} onClose={onClose} />);
    expect(screen.getByText("Data Management")).toBeInTheDocument();
    expect(screen.getByText("Export Data")).toBeInTheDocument();
    expect(screen.getByText("Import Data")).toBeInTheDocument();
    expect(screen.getByText("Clear data")).toBeInTheDocument();
  });

  it("calls exportData when Download is clicked", async () => {
    const user = userEvent.setup();
    render(<DataManagementDialog open={true} onClose={onClose} />);

    // Checkboxes are checked by default
    const downloadBtn = screen.getByText("Download Backup");
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(mockExportData).toHaveBeenCalled();
    });
    const payload = mockExportData.mock.calls[0][0] as { userId: string; notes: unknown[] };
    expect(payload.userId).toBe("test-user");
    expect(payload.notes).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("switches to Import tab", async () => {
    const user = userEvent.setup();
    render(<DataManagementDialog open={true} onClose={onClose} />);

    const importTab = screen.getByText("Import Data");
    await user.click(importTab);

    await waitFor(() => {
      expect(screen.getByText("Upload Backup File")).toBeInTheDocument();
    });
  });

  it("requires an explicit confirmation before clearing research data", async () => {
    const user = userEvent.setup();
    render(<DataManagementDialog open={true} onClose={onClose} />);

    await user.click(screen.getByRole("tab", { name: "Clear data" }));
    await user.click(screen.getByRole("button", { name: "Clear all data" }));

    expect(
      screen.getByRole("alertdialog", { name: "Clear all research data" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/notes, papers, ideas, tasks, topics, and their connections/i),
    ).toBeInTheDocument();
  });
});
