/**
 * In-memory Supabase-compatible client for ResearchQuest demo mode.
 *
 * The demo client mirrors the small subset of the Supabase JS API used by the
 * app: auth, postgrest-style queries, two RPCs, function invocation, and
 * realtime channels. Data is seeded from `demoData.ts` and mutated in place so
 * every view is fully interactive without a backend.
 */

import {
  buildDemoTables,
  generateId,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  DEMO_USERNAME,
  type Row as DemoRow,
} from "./demoData";

type Row = DemoRow;
type TableName = string;

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
}

interface ChannelSubscription {
  table: string;
  filter?: string;
  callback: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new?: Row;
    old?: Row;
  }) => void;
}

interface DemoChannel {
  on: (
    event: string,
    config: { table: string; filter?: string },
    callback: ChannelSubscription["callback"],
  ) => DemoChannel;
  subscribe: (callback?: (status: string) => void) => DemoChannel;
  unsubscribe: () => void;
}

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
  count: number | null;
};

const tables: Record<TableName, Row[]> = buildDemoTables();

function makeSession(email: string): Session {
  return {
    access_token: `demo-access-${Date.now()}`,
    refresh_token: `demo-refresh-${Date.now()}`,
    expires_at: Date.now() + 1000 * 60 * 60 * 24,
    user: {
      id: DEMO_USER_ID,
      email,
      user_metadata: { username: DEMO_USERNAME },
    },
  };
}

/** Demo mode starts signed in so first-run lands in the workspace, not auth. */
let currentSession: Session | null = makeSession(DEMO_USER_EMAIL);
const authListeners: Array<(event: string, session: Session | null) => void> =
  [];
const channelSubscriptions: Array<ChannelSubscription & { channel: string }> =
  [];

function emitAuth(event: string, session: Session | null) {
  authListeners.forEach((listener) => listener(event, session));
}

function emitTable(table: TableName, payload: Parameters<ChannelSubscription["callback"]>[0]) {
  channelSubscriptions.forEach((subscription) => {
    if (subscription.table !== table) return;
    const filter = subscription.filter ?? "";
    const payloadUserId =
      (payload.new as Row | undefined)?.user_id ??
      (payload.old as Row | undefined)?.user_id;
    const filterUserId = filter.match(/user_id=eq\.([^\s]+)/)?.[1];
    if (filterUserId && payloadUserId && filterUserId !== payloadUserId) {
      return;
    }
    subscription.callback(payload);
  });
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const aDate = typeof a === "string" ? Date.parse(a) : NaN;
  const bDate = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return aDate - bDate;
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function matchesFilter(
  row: Row,
  filter: { column: string; operator: string; value: unknown; negatedValue?: unknown },
): boolean {
  const actual = row[filter.column];
  switch (filter.operator) {
    case "eq":
      return actual === filter.value;
    case "neq":
      return actual !== filter.value;
    case "gt":
      return compareValues(actual, filter.value) > 0;
    case "gte":
      return compareValues(actual, filter.value) >= 0;
    case "lt":
      return compareValues(actual, filter.value) < 0;
    case "lte":
      return compareValues(actual, filter.value) <= 0;
    case "is":
      return filter.value == null ? actual == null : actual === filter.value;
    case "in": {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      return values.some((value) => actual === value);
    }
    case "contains":
      if (Array.isArray(actual)) {
        const wanted = Array.isArray(filter.value) ? filter.value : [filter.value];
        return wanted.every((value) => actual.includes(value));
      }
      return false;
    case "is-not-null":
      return actual != null;
    case "not":
      return !matchesFilter(row, {
        column: filter.column,
        operator: String(filter.value),
        value: filter.negatedValue,
      });
    default:
      return false;
  }
}

function parseSelect(select: string): {
  all: boolean;
  scalarColumns: string[];
  relationships: Array<{ table: string; columns: string[] }>;
} {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of select) {
    if (char === "(") {
      depth++;
      current += char;
    } else if (char === ")") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);

  const all = parts.some((part) => part.trim() === "*");
  const scalarColumns: string[] = [];
  const relationships: Array<{ table: string; columns: string[] }> = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "*") continue;
    const openParen = trimmed.indexOf("(");
    if (openParen === -1) {
      scalarColumns.push(trimmed);
    } else {
      const table = trimmed.slice(0, openParen).trim();
      const inner = trimmed
        .slice(openParen + 1, trimmed.lastIndexOf(")"))
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean);
      relationships.push({ table, columns: inner });
    }
  }

  return { all, scalarColumns, relationships };
}

function countTopicLinks(table: string, row: Row): number {
  const linkTable = tables[table];
  if (!linkTable) return 0;
  const entityColumn =
    table === "topic_notes"
      ? "note_id"
      : table === "topic_papers"
        ? "paper_id"
        : "idea_id";
  return linkTable.filter(
    (link) =>
      link.user_id === row.user_id &&
      (link.topic_id === row.id || link[entityColumn] === row.id),
  ).length;
}

function projectRow(row: Row, select: string): Row {
  const parsed = parseSelect(select);
  if (parsed.all && parsed.relationships.length === 0 && parsed.scalarColumns.length === 0) {
    return { ...row };
  }

  const projected: Row = parsed.all ? { ...row } : {};
  for (const column of parsed.scalarColumns) {
    if (column in row) projected[column] = row[column];
  }
  for (const relationship of parsed.relationships) {
    const { table, columns } = relationship;
    if (columns.length === 1 && columns[0] === "count") {
      projected[table] = [{ count: countTopicLinks(table, row) }];
      continue;
    }
    if (table === "topics") {
      const topic = tables.topics.find((item) => item.id === row.topic_id);
      if (topic) {
        const topicProjection: Row = {};
        columns.forEach((column) => {
          if (column in topic) topicProjection[column] = topic[column];
        });
        projected.topics = topicProjection;
      }
      continue;
    }
    const related = (tables[table] ?? []).filter((item) => item.id === row[`${table.replace(/s$/, "")}_id`] || item.id === row[table === "topics" ? "topic_id" : `${table}_id`]);
    projected[table] = related.map((item) => {
      const itemProjection: Row = {};
      columns.forEach((column) => {
        if (column in item) itemProjection[column] = item[column];
      });
      return itemProjection;
    });
  }
  return projected;
}

class DemoQuery {
  private tableName: TableName;
  private operation: "read" | "insert" | "upsert" | "update" | "delete" = "read";
  private selectColumns = "*";
  private countRequested = false;
  private headOnly = false;
  private filters: Array<{
    column: string;
    operator: string;
    value: unknown;
    negatedValue?: unknown;
  }> = [];
  private sorts: Array<{ column: string; ascending: boolean; nullsFirst: boolean }> = [];
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private limitValue: number | null = null;
  private wantSingle = false;
  private wantMaybeSingle = false;
  private insertRows: Row[] = [];
  private updatePatch: Row = {};
  private onConflict: string | null = null;
  private returnSelected = false;

  constructor(tableName: TableName) {
    this.tableName = tableName;
  }

  select(columns?: string | null, options?: { count?: "exact"; head?: boolean }): this {
    if (columns) this.selectColumns = columns;
    if (options?.count === "exact") this.countRequested = true;
    if (options?.head) this.headOnly = true;
    if (this.operation !== "read") this.returnSelected = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, operator: "neq", value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ column, operator: "gt", value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column, operator: "lt", value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, operator: "in", value: values });
    return this;
  }

  contains(column: string, value: unknown): this {
    this.filters.push({ column, operator: "contains", value });
    return this;
  }

  match(values: Row): this {
    Object.entries(values).forEach(([column, value]) => {
      this.filters.push({ column, operator: "eq", value });
    });
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator === "is") {
      if (value === null) {
        this.filters.push({ column, operator: "is-not-null", value: null });
      } else {
        this.filters.push({ column, operator: "is", value });
      }
    } else {
      this.filters.push({
        column,
        operator: "not",
        value: operator,
        negatedValue: value,
      });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.sorts.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst ?? false,
    });
    return this;
  }

  range(from: number, to: number): this {
    this.rangeStart = from;
    this.rangeEnd = to;
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  single(): this {
    this.wantSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.wantMaybeSingle = true;
    return this;
  }

  insert(rows: Row | Row[]): this {
    this.operation = "insert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string }): this {
    this.operation = "upsert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    this.onConflict = options?.onConflict ?? "id";
    return this;
  }

  update(patch: Row): this {
    this.operation = "update";
    this.updatePatch = patch;
    return this;
  }

  delete(): this {
    this.operation = "delete";
    return this;
  }

  private filteredRows(): Row[] {
    return (tables[this.tableName] ?? []).filter((row) =>
      this.filters.every((filter) => matchesFilter(row, filter)),
    );
  }

  private sortedRows(rows: Row[]): Row[] {
    const result = [...rows];
    for (const sort of [...this.sorts].reverse()) {
      result.sort((a, b) => {
        const aValue = a[sort.column];
        const bValue = b[sort.column];
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sort.nullsFirst ? -1 : 1;
        if (bValue == null) return sort.nullsFirst ? 1 : -1;
        const compared = compareValues(aValue, bValue);
        return sort.ascending ? compared : -compared;
      });
    }
    return result;
  }

  private slicedRows(rows: Row[]): Row[] {
    let result = rows;
    if (this.rangeStart != null && this.rangeEnd != null) {
      result = result.slice(this.rangeStart, this.rangeEnd + 1);
    }
    if (this.limitValue != null) {
      result = result.slice(0, this.limitValue);
    }
    return result;
  }

  private execute(): QueryResult {
    if (this.operation === "read") {
      const allRows = this.filteredRows();
      const ordered = this.sortedRows(allRows);
      const sliced = this.slicedRows(ordered);
      const count = this.countRequested ? allRows.length : null;
      const data = this.headOnly
        ? []
        : sliced.map((row) => projectRow(row, this.selectColumns));

      if (this.wantSingle || this.wantMaybeSingle) {
        return {
          data: data[0] ?? null,
          error: null,
          count: data.length > 0 ? 1 : 0,
        };
      }
      return { data, error: null, count };
    }

    if (this.operation === "insert" || this.operation === "upsert") {
      const tableRows = (tables[this.tableName] ??= []);
      const inserted: Row[] = [];
      const conflictColumns = (this.onConflict ?? "id")
        .split(",")
        .map((column) => column.trim());

      for (const input of this.insertRows) {
        const existing =
          this.operation === "upsert"
            ? tableRows.find((row) =>
                conflictColumns.every(
                  (column) =>
                    column in row &&
                    column in input &&
                    row[column] === input[column],
                ),
              )
            : undefined;

        const now = new Date().toISOString();
        const row: Row = {
          ...input,
          id: input.id ?? generateId(this.tableName),
          created_at: input.created_at ?? now,
          updated_at: now,
        };

        if (existing) {
          Object.assign(existing, row);
          inserted.push(existing);
          emitTable(this.tableName, {
            eventType: "UPDATE",
            new: existing,
            old: { ...existing },
          });
        } else {
          tableRows.push(row);
          inserted.push(row);
          emitTable(this.tableName, { eventType: "INSERT", new: row });
        }
      }

      const data = this.returnSelected
        ? inserted.map((row) => projectRow(row, this.selectColumns))
        : null;
      return {
        data: this.wantSingle || this.wantMaybeSingle ? data?.[0] ?? null : data,
        error: null,
        count: inserted.length,
      };
    }

    if (this.operation === "update") {
      const matching = this.filteredRows();
      const updated: Row[] = [];
      for (const row of matching) {
        const previous = { ...row };
        const now = new Date().toISOString();
        Object.entries(this.updatePatch).forEach(([column, value]) => {
          if (value !== undefined) row[column] = value;
        });
        row.updated_at = now;
        updated.push(row);
        emitTable(this.tableName, {
          eventType: "UPDATE",
          new: row,
          old: previous,
        });
      }
      const data = this.returnSelected
        ? updated.map((row) => projectRow(row, this.selectColumns))
        : null;
      return {
        data: this.wantSingle || this.wantMaybeSingle ? data?.[0] ?? null : data,
        error: null,
        count: updated.length,
      };
    }

    // delete
    const tableRows = tables[this.tableName] ?? [];
    const matching = this.filteredRows();
    const remaining = tableRows.filter((row) => !matching.includes(row));
    matching.forEach((row) =>
      emitTable(this.tableName, { eventType: "DELETE", old: row }),
    );
    tables[this.tableName] = remaining;
    return { data: null, error: null, count: matching.length };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onFulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return new Promise((resolve, reject) => {
      try {
        const result = this.execute();
        resolve(result as QueryResult);
      } catch (error) {
        reject(error);
      }
    }).then(onFulfilled as ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null | undefined, onRejected);
  }

  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<QueryResult | TResult> {
    return this.then(undefined, onRejected);
  }
}

const demoAuth = {
  async getSession() {
    return { data: { session: currentSession }, error: null };
  },
  async getUser() {
    return {
      data: { user: currentSession?.user ?? null },
      error: null,
    };
  },
  async signInWithPassword({ email }: { email: string; password: string }) {
    const session = makeSession(email);
    currentSession = session;
    emitAuth("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  },
  async signUp({ email }: { email: string; password: string }) {
    const session = makeSession(email);
    currentSession = session;
    emitAuth("SIGNED_IN", session);
    return {
      data: { user: session.user, session },
      error: null,
    };
  },
  async signOut() {
    currentSession = null;
    emitAuth("SIGNED_OUT", null);
    return { error: null };
  },
  async resetPasswordForEmail(_email: string) {
    return { data: null, error: null };
  },
  async signInWithOAuth() {
    return { data: null, error: null };
  },
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    authListeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const index = authListeners.indexOf(callback);
            if (index !== -1) authListeners.splice(index, 1);
          },
        },
      },
    };
  },
};

const demoFunctions = {
  async invoke(functionName: string, options?: { body?: unknown }) {
    const body = (options?.body ?? {}) as Record<string, unknown>;

    if (functionName === "fetch-paper") {
      const mockPapers = [
        {
          doi: "10.48550/arXiv.2005.11401",
          title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
          authors: ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus"],
          abstract:
            "Large pre-trained language models struggle to store and access knowledge. RAG combines parametric and non-parametric memory.",
          publicationDate: 2020,
          sourceUrl: "https://arxiv.org/abs/2005.11401",
          containerTitle: "arXiv",
          publisher: "arXiv",
          type: "preprint",
        },
        {
          doi: "10.48550/arXiv.1706.03762",
          title: "Attention Is All You Need",
          authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
          abstract:
            "The Transformer architecture replaces recurrence with attention mechanisms.",
          publicationDate: 2017,
          sourceUrl: "https://arxiv.org/abs/1706.03762",
          containerTitle: "arXiv",
          publisher: "arXiv",
          type: "preprint",
        },
        {
          doi: "10.48550/arXiv.2210.03629",
          title: "ReAct: Synergizing Reasoning and Acting in Language Models",
          authors: ["Shunyu Yao", "Jeffrey Zhao", "Dian Yu"],
          abstract:
            "Interleaving reasoning traces and actions enables grounded decision making.",
          publicationDate: 2022,
          sourceUrl: "https://arxiv.org/abs/2210.03629",
          containerTitle: "arXiv",
          publisher: "arXiv",
          type: "preprint",
        },
      ];
      const isQuery = Boolean(body.query);
      const result = isQuery ? mockPapers.slice(0, Number(body.rows) || 3) : mockPapers[0];
      return { data: { data: result, error: null }, error: null };
    }

    if (functionName === "deep-research") {
      const query = String(body.query ?? "research");
      return {
        data: {
          data: {
            query,
            reasoningSteps: [
              "Parsed the query into key concepts and scope.",
              "Searched the seeded literature for high-signal sources.",
              "Cross-referenced papers, notes, and ideas for coverage.",
              "Summarized evidence and flagged gaps.",
            ],
            summary: `Demo deep research on "${query}". The workspace suggests focusing on retrieval, attention, and reproducibility to close the largest evidence gaps.`,
            suggestedKeywords: [
              "retrieval-augmented generation",
              "attention mechanism",
              "reproducible research",
              "human-AI collaboration",
            ],
            timestamp: new Date().toISOString(),
            papers: [
              {
                title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                year: 2020,
                citationCount: 12000,
                authors: ["Patrick Lewis"],
                abstract:
                  "RAG combines parametric and non-parametric memory for knowledge-intensive tasks.",
              },
              {
                title: "Attention Is All You Need",
                year: 2017,
                citationCount: 150000,
                authors: ["Ashish Vaswani"],
                abstract:
                  "The Transformer architecture relies entirely on attention mechanisms.",
              },
            ],
          },
        },
        error: null,
      };
    }

    return { data: { ok: true, demo: true }, error: null };
  },
};

const demoRealtime = {
  channel(name: string): DemoChannel {
    return {
      on(event: string, config: { table: string; filter?: string }, callback: ChannelSubscription["callback"]) {
        if (event === "postgres_changes") {
          channelSubscriptions.push({ channel: name, table: config.table, filter: config.filter, callback });
        }
        return this;
      },
      subscribe(callback?: (status: string) => void) {
        setTimeout(() => callback?.("SUBSCRIBED"), 0);
        return this;
      },
      unsubscribe() {
        const remaining = channelSubscriptions.filter(
          (subscription) => subscription.channel !== name,
        );
        channelSubscriptions.length = 0;
        channelSubscriptions.push(...remaining);
      },
    };
  },
  removeChannel() {
    return { data: null, error: null };
  },
};

export const demoSupabase = {
  auth: demoAuth,
  functions: demoFunctions,
  channel: demoRealtime.channel,
  removeChannel: demoRealtime.removeChannel,
  from(tableName: TableName) {
    return new DemoQuery(tableName);
  },
  rpc(functionName: string, args: Record<string, unknown>) {
    if (functionName === "save_idea_with_links") {
      const ideas = (tables.ideas ??= []);
      const now = new Date().toISOString();
      if (args.p_idea_id) {
        const existing = ideas.find((idea) => idea.id === args.p_idea_id);
        if (existing) {
          Object.assign(existing, {
            title: args.p_title,
            description: args.p_description ?? null,
            stage: args.p_stage,
            linked_note_ids: args.p_linked_note_ids ?? [],
            linked_paper_ids: args.p_linked_paper_ids ?? [],
            updated_at: now,
          });
          emitTable("ideas", { eventType: "UPDATE", new: existing, old: { ...existing } });
          return Promise.resolve({ data: existing, error: null });
        }
      }
      const created: Row = {
        id: generateId("idea"),
        user_id: args.p_user_id,
        title: args.p_title,
        description: args.p_description ?? null,
        stage: args.p_stage ?? "Seed",
        linked_note_ids: args.p_linked_note_ids ?? [],
        linked_paper_ids: args.p_linked_paper_ids ?? [],
        created_at: now,
        updated_at: now,
      };
      ideas.push(created);
      emitTable("ideas", { eventType: "INSERT", new: created });
      return Promise.resolve({ data: created, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  },
};

export const demoSessionUser = {
  id: DEMO_USER_ID,
  email: DEMO_USER_EMAIL,
  user_metadata: { username: DEMO_USERNAME },
};
