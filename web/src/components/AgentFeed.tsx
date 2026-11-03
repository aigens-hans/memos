import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import { memoDetailQueryOptions } from "@/hooks/useMemoQueries";
import { type AgentItem, bridgeRequest } from "@/lib/agent-bridge";

type View = "for_you" | "all" | "kept" | "remembered";
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
type Feed = { items: AgentItem[]; next_cursor: string | null; status: { warnings?: string[] } };

function FeedCard({ item }: { item: AgentItem }) {
  const memo = useQuery(memoDetailQueryOptions(`memos/${item.memo_uid}`));
  if (memo.isError) return <p role="alert">Could not load this memo.</p>;
  if (!memo.data) return null;
  return (
    <div className="rounded-lg border p-4">
      <MemoView memo={memo.data} showVisibility />
      <details>
        <summary>Why this card</summary>
        {item.why?.map((why, i) => (
          <p key={`${why.text}-${i}`}>
            {why.text} {why.weight}
          </p>
        ))}
      </details>
    </div>
  );
}

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
  const key = `agent-feed-view:${userName}`;
  const [view, setView] = useState<View>(() => {
    const saved = sessionStorage.getItem(key);
    return ["for_you", "all", "kept", "remembered"].includes(saved ?? "") ? (saved as View) : "for_you";
  });
  const query = useInfiniteQuery({
    queryKey: ["agent-feed", userName, view],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      bridgeRequest<Feed>(
        `feed?view=${view === "kept" ? "kept" : "for_you"}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (page) => page?.next_cursor ?? undefined,
    enabled: view === "for_you" || view === "kept",
    retry: false,
  });
  const status = useQuery({
    queryKey: ["agent-feed-status", userName],
    queryFn: () => bridgeRequest<{ warnings?: string[] }>("feed/status"),
    refetchInterval: 60000,
  });
  const memories = useQuery({
    queryKey: ["agent-memories", userName],
    queryFn: () => bridgeRequest<Memory[]>("memories"),
    enabled: view === "remembered",
  });
  const warnings = status.data?.warnings ?? query.data?.pages[0]?.status.warnings ?? [];
  return (
    <div className="space-y-3">
      <nav aria-label="Feed views" className="flex flex-wrap gap-2">
        {(
          [
            ["for_you", "For you"],
            ["all", "All"],
            ["kept", "Kept"],
            ["remembered", "Remembered"],
          ] as const
        ).map(([id, label]) => (
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
      {warnings.length > 0 && (
        <aside aria-label="Feed coverage" className="rounded border p-3 text-sm">
          <p>Some chats are still awaiting processing. The feed may be incomplete.</p>
          {[...new Set(warnings)].map((w) => (
            <p key={w}>{w}</p>
          ))}
        </aside>
      )}
      <Preferences userName={userName} />
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
              <FeedCard key={item.memo_uid} item={item} />
            ))}
          {query.data?.pages[0]?.items.length === 0 && <p>No cards in this view yet. All keeps your full timeline available.</p>}
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
