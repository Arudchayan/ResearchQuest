import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const API_SCOPE_OPTIONS = [
  { value: "keys:read", label: "Read API keys" },
  { value: "keys:write", label: "Revoke API keys" },
  { value: "notes:read", label: "Read notes" },
  { value: "notes:write", label: "Create and update notes" },
  { value: "papers:read", label: "Read papers" },
  { value: "papers:write", label: "Create and update papers" },
  { value: "ideas:read", label: "Read ideas" },
  { value: "ideas:write", label: "Create and update ideas" },
  { value: "topics:read", label: "Read topics" },
  { value: "topics:write", label: "Create and update topics" },
  { value: "tasks:read", label: "Read tasks" },
  { value: "tasks:write", label: "Create and update tasks" },
  { value: "goals:read", label: "Read goals" },
  { value: "goals:write", label: "Create and update goals" },
  { value: "feeds:read", label: "Read feeds" },
  { value: "feeds:write", label: "Create and update feeds" },
  { value: "feeds:ingest", label: "Ingest feeds" },
] as const;

type ApiScope = (typeof API_SCOPE_OPTIONS)[number]["value"];

interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ApiScope[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface ApiKeysPanelProps {
  active: boolean;
}

interface ListKeysResponse {
  data: ApiKeyRecord[];
}

interface CreateKeyResponse {
  key: string;
  api_key: ApiKeyRecord;
}

function apiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Supabase URL is not configured.");
  }
  return `${baseUrl}/functions/v1/api/v1${path}`;
}

async function getSessionToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Sign in again to manage API keys.");
  }
  return token;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const message = body?.error?.message || body?.message || response.statusText;
    if (
      response.status === 404 &&
      (message === "Requested function was not found" ||
        /function was not found/i.test(String(message)))
    ) {
      return "Agent API edge function is not deployed. Deploy supabase/functions/api and apply pending migrations.";
    }
    return message || "Request failed";
  } catch {
    if (response.status === 404) {
      return "Agent API edge function is not deployed. Deploy supabase/functions/api and apply pending migrations.";
    }
    return response.statusText || "Request failed";
  }
}

function mapFetchFailure(err: unknown): Error {
  if (err instanceof TypeError) {
    return new Error(
      "Could not reach the Agent API gateway. Confirm the `api` edge function is deployed and CORS ALLOWED_ORIGINS includes this site.",
    );
  }
  return err instanceof Error ? err : new Error("Request failed");
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
    });
  } catch (err) {
    throw mapFetchFailure(err);
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

function SecretDialog({
  secret,
  onClose,
}: {
  secret: string | null;
  onClose: () => void;
}) {
  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("API key copied");
    } catch (err) {
      logger.error("Failed to copy API key", err);
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog.Root open={!!secret} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[70] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-surface shadow-2xl border border-border-subtle overflow-hidden outline-none animate-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border-subtle bg-bg-elevated">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-text-primary">
                  Copy your new API key
                </Dialog.Title>
                <Dialog.Description className="text-sm text-text-secondary">
                  This secret is shown once. Copy it now and store it securely.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
                aria-label="Close API key secret"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-6 space-y-4">
            <Input
              readOnly
              value={secret ?? ""}
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-xs"
              aria-label="New API key secret"
            />
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                ResearchQuest stores only a hash of this key. You cannot reveal
                it again after closing this dialog.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-bg-elevated">
            <Dialog.Close asChild>
              <Button variant="outline">Done</Button>
            </Dialog.Close>
            <Button onClick={copySecret}>
              <Copy className="w-4 h-4" />
              Copy key
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ApiKeysPanel({ active }: ApiKeysPanelProps) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([
    "notes:write",
    "tasks:write",
  ]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const activeKeys = useMemo(
    () => keys.filter((key) => !key.revoked_at).length,
    [keys],
  );

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<ListKeysResponse>("/keys");
      setKeys(response.data ?? []);
      setHasLoaded(true);
    } catch (err) {
      logger.error("Failed to load API keys", err);
      toast.error(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && !hasLoaded) {
      void loadKeys();
    }
  }, [active, hasLoaded, loadKeys]);

  const toggleScope = (scope: ApiScope) => {
    setSelectedScopes((current) =>
      current.includes(scope)
        ? current.filter((selected) => selected !== scope)
        : [...current, scope],
    );
  };

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name your API key");
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }

    setCreating(true);
    try {
      const response = await apiRequest<CreateKeyResponse>("/keys", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          scopes: selectedScopes,
        }),
      });
      setKeys((current) => [response.api_key, ...current]);
      setName("");
      setCreatedSecret(response.key);
      toast.success("API key created");
    } catch (err) {
      logger.error("Failed to create API key", err);
      toast.error(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (key: ApiKeyRecord) => {
    setRevokingId(key.id);
    try {
      await apiRequest<void>(`/keys/${key.id}`, { method: "DELETE" });
      const revokedAt = new Date().toISOString();
      setKeys((current) =>
        current.map((currentKey) =>
          currentKey.id === key.id
            ? { ...currentKey, revoked_at: revokedAt }
            : currentKey,
        ),
      );
      toast.success("API key revoked");
    } catch (err) {
      logger.error("Failed to revoke API key", err);
      toast.error(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200 flex items-start gap-3">
        <KeyRound className="w-5 h-5 shrink-0" />
        <p>
          Mint scoped API keys for local scripts and agents. Key secrets are
          only shown once, and revoked keys can no longer access the gateway.
        </p>
      </div>

      <form
        onSubmit={createKey}
        className="p-4 rounded-xl border border-border-subtle bg-bg-base/50 space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <label
              htmlFor="api-key-name"
              className="text-sm font-medium text-text-secondary"
            >
              Key name
            </label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Local agent"
              maxLength={100}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={creating}
              className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {creating ? "Creating..." : "Create key"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-text-secondary">
              Scopes
            </span>
            <span className="text-xs text-text-tertiary">
              {selectedScopes.length} selected
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {API_SCOPE_OPTIONS.map((scope) => {
              const checked = selectedScopes.includes(scope.value);
              return (
                <label
                  key={scope.value}
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                      : "bg-bg-surface border-border-subtle hover:border-border-moderate"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleScope(scope.value)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-text-primary">
                      {scope.value}
                    </span>
                    <span className="block text-xs text-text-tertiary">
                      {scope.label}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Existing keys
            </h3>
            <p className="text-xs text-text-tertiary">
              {activeKeys} active of {keys.length} total
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadKeys()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border border-border-subtle overflow-hidden">
          {loading && !hasLoaded ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading API keys...
            </div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-text-primary">No API keys yet</p>
              <p className="text-sm text-text-secondary mt-1">
                Create a key to connect an agent or script.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {keys.map((key) => {
                const revoked = Boolean(key.revoked_at);
                return (
                  <article
                    key={key.id}
                    className="p-4 bg-bg-surface flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-text-primary">
                            {key.name}
                          </h4>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              revoked
                                ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/10 dark:text-red-300 dark:border-red-800"
                                : "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/10 dark:text-green-300 dark:border-green-800"
                            }`}
                          >
                            {revoked ? "Revoked" : "Active"}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary font-mono mt-1">
                          {shortId(key.id)} · {key.key_prefix}...
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revoked || revokingId === key.id}
                        onClick={() => void revokeKey(key)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {revokingId === key.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {revoked ? "Revoked" : "Revoke"}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs px-2 py-1 rounded bg-bg-base border border-border-subtle text-text-secondary font-mono"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>

                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-text-tertiary">Created</dt>
                        <dd className="text-text-secondary">
                          {formatDate(key.created_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-tertiary">Last used</dt>
                        <dd className="text-text-secondary">
                          {formatDate(key.last_used_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-tertiary">Revoked</dt>
                        <dd className="text-text-secondary">
                          {formatDate(key.revoked_at)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SecretDialog secret={createdSecret} onClose={() => setCreatedSecret(null)} />
    </section>
  );
}
