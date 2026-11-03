import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAgentActions } from "@/hooks/useAgentActions";
import type { AgentHandler, AgentItem } from "@/lib/agent-bridge";

interface Props {
  memoName: string;
  memoContent: string;
  userName: string;
  children: ReactNode;
}

function InlineActions({ memoName, userName, memoContent, children }: Props) {
  const { query, mutation } = useAgentActions(memoName, userName, memoContent);
  const [selected, setSelected] = useState<AgentHandler | null>(null);
  const [question, setQuestion] = useState("");
  const item = query.data;
  const error = mutation.error ?? query.error;
  const current = item?.memo_content === memoContent;
  const busy = mutation.isPending || !current;
  const decide = (decision: AgentItem["decision"]) => {
    if (item) mutation.mutate({ kind: "decision", revision: item.revision, decision });
  };
  const queue = () => {
    if (!item || !selected) return;
    mutation.mutate(
      { kind: "job", revision: item.revision, handler: selected, question },
      {
        onSuccess: () => {
          setSelected(null);
          setQuestion("");
        },
      },
    );
  };
  const discarded = current && item?.decision === "discard";

  return (
    <>
      {!discarded && children}
      <section aria-label="Memo actions" className="mt-3 border-t pt-3 space-y-3 text-sm" onClick={(event) => event.stopPropagation()}>
        {error && (
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
        )}
        {query.isPending && (
          <p role="status" className="text-muted-foreground">
            Loading actions…
          </p>
        )}
        {item && !current && (
          <p role="status" className="text-muted-foreground">
            Updating memo content before enabling actions…
          </p>
        )}
        {item && (
          <>
            {discarded ? (
              <div className="flex items-center gap-3">
                <span>Discarded</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("pending")}>
                  Undo
                </Button>
              </div>
            ) : (
              <>
                {item.warnings.map((warning) => (
                  <p key={warning} className="text-muted-foreground">
                    {warning}
                  </p>
                ))}
                {item.suggestions
                  .filter((s) => ["learn_more", "draft_reply"].includes(s.handler))
                  .map((suggestion) => (
                    <div key={suggestion.handler} className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setSelected(suggestion.handler)}>
                        {suggestion.label}
                      </Button>
                      <span className="text-muted-foreground">{suggestion.reason}</span>
                    </div>
                  ))}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("keep")}>
                    Keep
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("remember")}>
                    Remember
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected("learn_more")}>
                    Learn more
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("discard")}>
                    Discard
                  </Button>
                </div>
                {item.decision === "keep" && <p role="status">Kept for later</p>}
                {item.decision === "remember" && <p role="status">Remembered with source and context</p>}
                {selected && (
                  <div className="space-y-2">
                    <label className="block" htmlFor={`agent-question-${memoName.split("/")[1]}`}>
                      Question or instructions
                    </label>
                    <textarea
                      id={`agent-question-${memoName.split("/")[1]}`}
                      className="w-full rounded-md border bg-background p-2"
                      maxLength={2000}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder="Optional"
                    />
                    <p className="text-muted-foreground">
                      {selected === "draft_reply"
                        ? "The agent will return a draft here for review. Nothing will be sent."
                        : "The agent will return its findings here."}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={queue}>
                        {selected === "draft_reply" ? "Queue draft" : "Queue research"}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {item.jobs.map((job) => (
                  <div key={job.id} className="rounded-md border p-3 space-y-2">
                    <p role="status">
                      {job.handler === "draft_reply" ? "Draft" : "Research"} {job.status}
                    </p>
                    {job.result && <p className="whitespace-pre-wrap break-words">{job.result}</p>}
                    {job.status === "expired" && (
                      <p className="text-muted-foreground">The worker timed out. Review its run before retrying.</p>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}
        {query.isError && (
          <Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>
            Retry
          </Button>
        )}
      </section>
    </>
  );
}

export default function MemoAgentActions(props: Props) {
  if (import.meta.env.VITE_AGENT_BRIDGE_ENABLED !== "true") return <>{props.children}</>;
  return <InlineActions {...props} />;
}
