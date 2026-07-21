import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeysPanel } from "../../components/settings/ApiKeysPanel";
import { mockSupabaseClient } from "../mocks/supabase";

const fetchMock = vi.fn();

const activeKey = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Existing agent",
  key_prefix: "rq_abcdef12",
  scopes: ["notes:write", "tasks:write"],
  expires_at: null,
  revoked_at: null,
  last_used_at: null,
  created_at: "2026-07-20T18:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiKeysPanel", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lists and revokes API keys through the gateway", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [activeKey] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<ApiKeysPanel active={true} />);

    expect(await screen.findByText("Existing agent")).toBeInTheDocument();
    expect(screen.getByText(/rq_abcdef12/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /revoke/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "https://example.supabase.co/functions/v1/api/v1/keys/11111111-1111-4111-8111-111111111111",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findAllByText("Revoked")).not.toHaveLength(0);
  });

  it("creates an API key and shows the secret once", async () => {
    const user = userEvent.setup();
    const createdKey = {
      ...activeKey,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Local agent",
      key_prefix: "rq_newkey12",
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ key: "rq_new-secret", api_key: createdKey }, 201),
      );

    render(<ApiKeysPanel active={true} />);

    await screen.findByText("No API keys yet");
    await user.type(screen.getByLabelText("Key name"), "Local agent");
    await user.click(screen.getByRole("button", { name: /create key/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, createInit] = fetchMock.mock.calls[1];
    const headers = createInit.headers as Headers;
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://example.supabase.co/functions/v1/api/v1/keys",
    );
    expect(createInit.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer session-token");
    expect(JSON.parse(createInit.body as string)).toEqual({
      name: "Local agent",
      scopes: ["notes:write", "tasks:write"],
    });

    expect(await screen.findByText("Copy your new API key")).toBeInTheDocument();
    expect(screen.getByLabelText("New API key secret")).toHaveValue(
      "rq_new-secret",
    );
    expect(screen.getByText("Local agent")).toBeInTheDocument();
  });

  it("explains when the api edge function is missing", async () => {
    const errorSpy = vi.spyOn(toast, "error").mockImplementation(() => "");
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: "NOT_FOUND", message: "Requested function was not found" },
        404,
      ),
    );

    render(<ApiKeysPanel active={true} />);

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/edge function is not deployed/i),
      );
    });

    errorSpy.mockRestore();
  });

  it("explains network/CORS failures when the gateway is unreachable", async () => {
    const errorSpy = vi.spyOn(toast, "error").mockImplementation(() => "");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<ApiKeysPanel active={true} />);

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Could not reach the Agent API gateway/i),
      );
    });

    errorSpy.mockRestore();
  });
});
