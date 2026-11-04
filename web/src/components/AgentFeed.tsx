import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import AgentBriefingCard from "@/components/AgentBriefingCard";
import RelativeTime from "@/components/RelativeTime";
import { Button } from "@/components/ui/button";
import { type AgentItem, bridgeRequest } from "@/lib/agent-bridge";

const views = [
  ["attention", "Needs attention"],
  ["for_you", "For you"],
  ["fyi", "FYI"],
  ["all", "All"],
  ["kept", "Kept"],
  ["remembered", "Remembered"],
] as const;
type View = (typeof views)[number][0];
const filterOptions = {
  kind: [
    ["all", "All types"],
    ["action", "Follow-ups"],
    ["insight", "Briefings"],
  ],
  urgency: [
    ["all", "Any urgency"],
    ["high", "High only"],
    ["medium_high", "Medium and high"],
    ["low", "Low / FYI"],
  ],
  context: [
    ["all", "All contexts"],
    ["Work", "Work"],
    ["Personal", "Personal"],
    ["Family", "Family"],
    ["Unsorted", "Unsorted"],
  ],
} as const;
type Filters = { [K in keyof typeof filterOptions]: (typeof filterOptions)[K][number][0] };
const defaultFilters: Filters = { kind: "all", urgency: "all", context: "all" };

function savedFilters(key: string): Filters {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value && Object.entries(filterOptions).every(([field, options]) => options.some(([id]) => id === value[field]))) return value;
  } catch {
    // Invalid saved selections must not prevent opening the feed.
  }
  return defaultFilters;
}
type Memory = { id: string; memo_uid: string; version: number; context: string; text: string; note: string };
type Preference = {
  id: string;
  version: number;
  feature: string;
  context: string;
  weight: number;
  enabled: boolean;
  origin: string;
  evidence: string[];
};
type FeedStatus = { warnings?: string[]; generated_at?: string };
type Feed = { items: AgentItem[]; next_cursor: string | null; status: FeedStatus };
type SyncState = {
  state: "idle" | "running" | "pending" | "busy" | "done" | "error" | "interrupted" | "unavailable";
  run_id?: string;
  published?: number;
  message?: string;
};
const activeSyncStates = ["running", "pending", "busy"];

function MemoryCard({ memory, refresh }: { memory: Memory; refresh: () => void }) {
  const [text, setText] = useState(memory.text);
  const [note, setNote] = useState(memory.note);
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation({
    mutationFn: (forget: boolean) =>
      forget
        ? bridgeRequest(`memories/${memory.id}?version=${memory.version}`, undefined, undefined, "DELETE")
        : bridgeRequest(`memories/${memory.id}`, { version: memory.version, text, note }, undefined, "PATCH"),
    onSuccess: refresh,
  });
  return (
    <article className="space-y-2 rounded border p-4">
      <p>
        {memory.context} · <a href={`/memos/${memory.memo_uid}`}>Source memo</a>
      </p>
      <label className="block">
        Remembered information
        <textarea
          aria-label="Remembered information"
          className="w-full border bg-background p-2"
          value={text}
          maxLength={16000}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <label className="block">
        Memory guidance
        <textarea
          aria-label="Memory guidance"
          className="w-full border bg-background p-2"
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Button disabled={mutation.isPending || !text.trim()} onClick={() => mutation.mutate(false)}>
        Save memory
      </Button>
      <Button variant="ghost" onClick={() => setConfirm(true)}>
        Forget
      </Button>
      {confirm && (
        <div>
          <p>
            Remove this information and learning based solely on it from future AI use? The original memo and Portal todo stay separate.
          </p>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>
            Confirm forget
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      )}
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </article>
  );
}

function Preferences({ userName }: { userName: string }) {
  const [context, setContext] = useState("Work");
  const query = useQuery({
    queryKey: ["agent-preferences", userName, context],
    queryFn: () => bridgeRequest<Preference[]>(`preferences?context=${context}`),
  });
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ path, body, method }: { path: string; body: unknown; method?: string }) => bridgeRequest(path, body, undefined, method),
    onSuccess: () => {
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["agent-feed"] });
    },
  });
  return (
    <details className="rounded border p-3">
      <summary>Learning preferences</summary>
      <select aria-label="Preference context" className="border bg-background" value={context} onChange={(e) => setContext(e.target.value)}>
        {["Work", "Personal", "Family", "Unsorted"].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <p>Preferences begin after feedback on three different cards. Only “Not relevant” counts as negative relevance.</p>
      {query.data?.map((p) => (
        <div key={`${p.id}-${p.version}`} className="my-2 space-x-2">
          <span>
            {p.feature} · {p.context} · {p.origin} · {p.evidence.length} feedback events
          </span>
          <input
            aria-label={`Weight ${p.feature}`}
            className="w-20 border bg-background"
            type="number"
            min={-20}
            max={20}
            defaultValue={p.weight}
            onBlur={(e) => {
              const weight = Number(e.target.value);
              if (Number.isFinite(weight) && weight !== p.weight)
                mutation.mutate({ path: `preferences/${p.id}`, method: "PATCH", body: { version: p.version, weight, enabled: p.enabled } });
            }}
          />
          <Button
            disabled={mutation.isPending}
            variant="ghost"
            onClick={() =>
              mutation.mutate({
                path: `preferences/${p.id}`,
                method: "PATCH",
                body: { version: p.version, weight: p.weight, enabled: !p.enabled },
              })
            }
          >
            {p.enabled ? "Disable" : "Enable"}
          </Button>
          {p.context !== "Global" && (
            <Button
              disabled={mutation.isPending}
              variant="ghost"
              onClick={() => mutation.mutate({ path: `preferences/${p.id}/make-global`, body: { version: p.version } })}
            >
              Apply globally
            </Button>
          )}
        </div>
      ))}
      <Button
        disabled={mutation.isPending}
        variant="outline"
        onClick={() => mutation.mutate({ path: "preferences/reset", body: { context } })}
      >
        Reset {context} preferences
      </Button>
      {(mutation.error || query.error) && <p role="alert">{(mutation.error || query.error)?.message}</p>}
    </details>
  );
}

export default function AgentFeed({ userName, children }: { userName: string; children: ReactNode }) {
  const client = useQueryClient();
  const syncKey = ["agent-sync-status", userName];
  const sync = useQuery({
    queryKey: syncKey,
    queryFn: () => bridgeRequest<SyncState>("sync"),
    refetchInterval: (query) => (activeSyncStates.includes(query.state.data?.state ?? "") ? 2000 : false),
    retry: false,
  });
  const syncNow = useMutation({
    mutationFn: () => bridgeRequest<SyncState>("sync", {}),
    onSuccess: (state) => {
      client.setQueryData(syncKey, state);
      void client.invalidateQueries({ queryKey: syncKey });
    },
  });
  useEffect(() => {
    if (sync.data?.state === "done") {
      void client.invalidateQueries({ queryKey: ["agent-feed"] });
      void client.invalidateQueries({ queryKey: ["agent-feed-status"] });
      void client.invalidateQueries({ queryKey: ["memos"] });
    }
  }, [client, sync.data?.state, sync.data?.run_id]);
  const syncing = syncNow.isPending || activeSyncStates.includes(sync.data?.state ?? "");
  const key = `agent-feed-view:${userName}`;
  const [view, setView] = useState<View>(() => {
    const saved = sessionStorage.getItem(key);
    return views.some(([id]) => id === saved) ? (saved as View) : "attention";
  });
  const filtersKey = `agent-feed-filters:${userName}`;
  const [filters, setFilters] = useState<Filters>(() => savedFilters(filtersKey));
  const updateFilters = (next: Filters) => {
    setFilters(next);
    sessionStorage.setItem(filtersKey, JSON.stringify(next));
  };
  const isCardView = view !== "all" && view !== "remembered";
  const query = useInfiniteQuery({
    queryKey: ["agent-feed", userName, view, filters],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      bridgeRequest<Feed>(
        `feed?${new URLSearchParams({
          view,
          ...filters,
          ...(pageParam ? { cursor: pageParam } : {}),
        })}`,
      ),
    getNextPageParam: (page) => page?.next_cursor ?? undefined,
    enabled: isCardView,
    retry: false,
  });
  const status = useQuery({
    queryKey: ["agent-feed-status", userName],
    queryFn: () => bridgeRequest<FeedStatus>("feed/status"),
    refetchInterval: 60000,
  });
  const memories = useQuery({
    queryKey: ["agent-memories", userName],
    queryFn: () => bridgeRequest<Memory[]>("memories"),
    enabled: view === "remembered",
  });
  const coverage = status.data ?? query.data?.pages[0]?.status;
  const warnings = coverage?.warnings ?? [];
  const scanDate = coverage?.generated_at ? new Date(coverage.generated_at) : null;
  const scanTime =
    scanDate && !Number.isNaN(scanDate.getTime())
      ? scanDate.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        })
      : null;
  return (
    <div className="space-y-3">
      <header className="space-y-1 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Your briefing</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">A few things worth your attention.</h1>
        <p className="text-sm text-muted-foreground">Updates and follow-ups from your messages, with the useful details up front.</p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="outline" disabled={syncing || sync.data?.state === "unavailable"} onClick={() => syncNow.mutate()}>
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
          {syncing && (
            <p role="status" className="text-xs text-muted-foreground">
              {sync.data?.state === "busy" ? "Another sync is already running." : "Fetching messages and updating your cards…"}
            </p>
          )}
          {sync.data?.state === "done" && (
            <p role="status" className="text-xs text-muted-foreground">
              Sync complete · {sync.data.published ?? 0} cards processed.
            </p>
          )}
          {sync.data?.state === "unavailable" && <p className="text-xs text-muted-foreground">Manual sync is not configured.</p>}
          {(sync.data?.state === "error" || sync.data?.state === "interrupted") && (
            <p role="alert" className="text-xs">
              {sync.data.message}
            </p>
          )}
          {syncNow.error && (
            <p role="alert" className="text-xs">
              Could not start sync: {syncNow.error.message}
            </p>
          )}
        </div>
      </header>
      <nav aria-label="Feed views" className="flex flex-wrap gap-2">
        {views.map(([id, label]) => (
          <Button
            key={id}
            variant={view === id ? "default" : "ghost"}
            aria-pressed={view === id}
            onClick={() => {
              setView(id);
              sessionStorage.setItem(key, id);
            }}
          >
            {label}
          </Button>
        ))}
      </nav>
      {isCardView && (
        <section aria-label="Card filters" className="space-y-2 rounded border p-3 text-sm">
          <div className="flex flex-wrap items-end gap-3">
            {(
              [
                ["kind", "Card type"],
                ["urgency", "Urgency"],
                ["context", "Card context"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex flex-col gap-1">
                {label}
                <select
                  className="rounded border bg-background p-1.5"
                  value={filters[field]}
                  onChange={(event) => updateFilters({ ...filters, [field]: event.target.value })}
                >
                  {filterOptions[field].map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <Button variant="ghost" onClick={() => updateFilters(defaultFilters)}>
              Reset filters
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {view === "attention"
              ? "Follow-ups and medium/high-urgency briefings."
              : view === "fyi"
                ? "Low-urgency briefing updates."
                : "Filter the cards in this view."}
          </p>
          {filters.urgency !== "all" && (
            <p className="text-xs text-muted-foreground">
              Urgency filters show briefing cards with an explicit urgency; follow-ups have no urgency rating.
            </p>
          )}
        </section>
      )}
      {warnings.length > 0 && (
        <aside aria-label="Feed coverage" className="rounded border p-3 text-sm">
          <p>Some chats are still awaiting processing. The feed may be incomplete.</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {scanTime ? "Times show how long ago this scan was generated." : "Scan time unavailable."}
          </p>
          {[...new Set(warnings)].map((w) => (
            <p key={w} className="flex flex-wrap gap-x-2">
              {scanTime && (
                <time dateTime={coverage?.generated_at} title={`Scan generated: ${scanTime}`} className="text-muted-foreground">
                  <RelativeTime date={scanDate ?? undefined} format="relative" />
                </time>
              )}
              <span>{w}</span>
            </p>
          ))}
        </aside>
      )}
      <div className="text-xs text-muted-foreground">
        <Preferences userName={userName} />
      </div>
      {view === "all" ? (
        children
      ) : view === "remembered" ? (
        <>
          {memories.isPending && <p role="status">Loading memories…</p>}
          {memories.error && <p role="alert">{memories.error.message}</p>}
          {memories.data?.length === 0 && <p>No remembered information yet.</p>}
          {memories.data?.map((m) => (
            <MemoryCard key={`${m.id}-${m.version}`} memory={m} refresh={() => void memories.refetch()} />
          ))}
        </>
      ) : (
        <>
          {query.isPending && <p role="status">Loading feed…</p>}
          {query.error && (
            <p role="alert">
              {query.error.message}
              <Button onClick={() => void query.refetch()}>Refresh feed</Button>
            </p>
          )}
          {query.data?.pages
            .flatMap((p) => p?.items ?? [])
            .map((item) => (
              <AgentBriefingCard key={item.memo_uid} item={item} userName={userName} />
            ))}
          {query.data?.pages[0]?.items.length === 0 && <p>No cards match this view. Try resetting filters or open All.</p>}
          {query.hasNextPage && (
            <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
