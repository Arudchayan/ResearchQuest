/**
 * Item 44 — gateway routing parity.
 *
 * - Gateway-success path: list rows resolve from the gateway with the
 *   server clamp applied (limit 1–200, default 100).
 * - Gateway-failure fallback path: transport/5xx failures fall back to the
 *   direct read silently (no throw) and are logged.
 * - Validation-error surfacing: 4xx gateway errors reject with the server
 *   message and never trigger the direct fallback.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  clampGatewayLimit,
  clampGatewayOffset,
  GatewayError,
  listViaGateway,
  listWithGatewayFallback,
} from "../../lib/apiGateway";

const BASE_URL = "https://example.supabase.co/functions/v1/api/v1";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("gateway list client (item 44)", () => {
  it("resolves rows via the gateway success path", async () => {
    const rows = [{ id: "n1", title: "Note" }];
    const fetchFn = vi.fn(async () => jsonResponse({ data: rows }, 200));

    const { data } = await listViaGateway<{ id: string }>("notes", {
      baseUrl: BASE_URL,
      accessToken: "test-token",
      fetchFn: fetchFn as unknown as typeof fetch,
      limit: 100,
      offset: 0,
    });

    expect(data).toEqual(rows);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/notes?limit=100&offset=0`);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
  });

  it("mirrors the server limit clamp (1–200, default 100)", () => {
    expect(clampGatewayLimit(undefined)).toBe(100);
    expect(clampGatewayLimit(Number.NaN)).toBe(100);
    expect(clampGatewayLimit(0)).toBe(1);
    expect(clampGatewayLimit(500)).toBe(200);
    expect(clampGatewayOffset(-5)).toBe(0);
  });

  it("falls back to the direct read silently on transport failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const directRows = [{ id: "direct-1" }];
    const direct = vi.fn(async () => directRows);
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await listWithGatewayFallback<{ id: string }>(
      "notes",
      {
        baseUrl: BASE_URL,
        accessToken: "test-token",
        fetchFn: fetchFn as unknown as typeof fetch,
      },
      direct,
    );

    expect(result).toEqual({ data: directRows, source: "direct" });
    expect(direct).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to the direct read on gateway 5xx", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const direct = vi.fn(async () => [{ id: "direct-1" }]);
    const fetchFn = vi.fn(async () =>
      jsonResponse({ error: { code: "INTERNAL_ERROR", message: "boom" } }, 500),
    );

    const result = await listWithGatewayFallback<{ id: string }>(
      "papers",
      {
        baseUrl: BASE_URL,
        accessToken: "test-token",
        fetchFn: fetchFn as unknown as typeof fetch,
      },
      direct,
    );

    expect(result.source).toBe("direct");
    expect(direct).toHaveBeenCalledTimes(1);
  });

  it("surfaces gateway validation errors without falling back", async () => {
    const direct = vi.fn(async () => [{ id: "direct-1" }]);
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "Invalid limit" } },
        400,
      ),
    );

    await expect(
      listWithGatewayFallback<{ id: string }>(
        "ideas",
        {
          baseUrl: BASE_URL,
          accessToken: "test-token",
          fetchFn: fetchFn as unknown as typeof fetch,
        },
        direct,
      ),
    ).rejects.toMatchObject({
      name: "GatewayError",
      message: "Invalid limit",
      status: 400,
      code: "VALIDATION_ERROR",
    });
    expect(direct).not.toHaveBeenCalled();
  });

  it("throws GatewayError (no fallback data) when unconfigured", async () => {
    const direct = vi.fn(async () => [{ id: "direct-1" }]);
    // No base URL and no VITE_SUPABASE_URL in tests → GATEWAY_UNAVAILABLE
    // (status 0) is a transport-class failure, so it falls back.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await listWithGatewayFallback<{ id: string }>(
      "tasks",
      { baseUrl: null },
      direct,
    );
    expect(result.source).toBe("direct");
    await expect(
      listViaGateway("tasks", { baseUrl: null }),
    ).rejects.toBeInstanceOf(GatewayError);
  });
});
