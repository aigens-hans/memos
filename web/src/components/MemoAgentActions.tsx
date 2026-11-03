import { type ReactNode, useState } from "react";
import AgentCorrections from "@/components/AgentCorrections";
import { Button } from "@/components/ui/button";
import { useAgentActions } from "@/hooks/useAgentActions";
import { type AgentHandler, agentRequest, bridgeRequest } from "@/lib/agent-bridge";

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
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [portalError, setPortalError] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);
  const [preview, setPreview] = useState<{ id: string; payload_hash: string; payload: Record<string, unknown> } | null>(null);
  const [editingTodo, setEditingTodo] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("medium");
  const [outcome, setOutcome] = useState<{ status: string; url: string | null } | null>(null);
  const portal = async (confirm = false) => {
    if (!item || busy) return;
    setPortalBusy(true);
    setPortalError("");
    try {
      if (confirm && preview) {
        const result = await bridgeRequest<{ status: string; url: string | null }>(`todo-previews/${preview.id}/confirm`, {
          payload_hash: preview.payload_hash,
          request_id: crypto.randomUUID(),
        });
        setOutcome(result);
        setPreview(null);
        setEditingTodo(false);
        void query.refetch();
      } else {
        const result = await agentRequest<NonNullable<typeof preview>>(memoName, "/todo-preview", {
          revision: item.revision,
          state_version: item.state_version,
          edits: { title, details, priority },
        });
        setPreview(result);
      }
    } catch (error) {
      setPortalError((error as Error).message);
    } finally {
      setPortalBusy(false);
    }
  };
  const item = query.data;
  const error = mutation.error ?? query.error;
  const current = item?.memo_content === memoContent;
  const busy = mutation.isPending || !current;
  const feedback = (action: string, payload?: unknown) => mutation.mutate({ kind: "feedback", action, payload });
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
  const discarded = current && item?.dismissed;

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
                <span>Dismissed</span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => feedback("undo_dismiss")}>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-pressed={item.kept}
                    onClick={() => feedback(item.kept ? "unkeep" : "keep")}
                  >
                    Keep
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-pressed={item.memory_ids?.length > 0}
                    onClick={() => mutation.mutate({ kind: "remember" })}
                  >
                    Remember
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected("learn_more")}>
                    Learn more
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDismissing(true)}>
                    Dismiss
                  </Button>
                </div>
                {item.kept && <p role="status">Kept for later</p>}
                {item.memory_ids?.length > 0 && <p role="status">Remembered with source and context</p>}
                <label className="block">
                  Context
                  <select
                    aria-label="Context"
                    className="ml-2 rounded border bg-background p-1"
                    value={item.context}
                    disabled={busy}
                    onChange={(e) => feedback("set_context", { context: e.target.value })}
                  >
                    {["Work", "Personal", "Family", "Unsorted"].map((context) => (
                      <option key={context}>{context}</option>
                    ))}
                  </select>
                </label>
                {item.change_explanation && <p>{item.change_explanation}</p>}
                <details>
                  <summary>Why this card</summary>
                  <p>
                    Selected from your messages. Explicit feedback adjusts ranking within this context; one dismissal does not suppress a
                    topic.
                  </p>
                  {item.why?.map((entry, i) => (
                    <p key={`${entry.text}-${i}`}>
                      {entry.text} {entry.weight}
                    </p>
                  ))}
                </details>
                {dismissing && (
                  <div className="space-y-2">
                    <label>
                      Reason (optional)
                      <select
                        aria-label="Dismiss reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="ml-2 border bg-background"
                      >
                        <option value="">No reason</option>
                        <option value="not_relevant">Not relevant</option>
                        <option value="already_know">Already know</option>
                        <option value="duplicate">Duplicate</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        feedback("dismiss", reason ? { reason } : {});
                        setDismissing(false);
                      }}
                    >
                      Confirm dismiss
                    </Button>
                    <Button variant="ghost" onClick={() => setDismissing(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
                <details>
                  <summary>Feedback or correction</summary>
                  <textarea
                    aria-label="Feedback or correction"
                    className="w-full border bg-background p-2"
                    maxLength={2000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button
                    disabled={busy || !comment.trim()}
                    onClick={() =>
                      mutation.mutate(
                        { kind: "feedback", action: "comment", payload: { text: comment } },
                        { onSuccess: () => setComment("") },
                      )
                    }
                  >
                    Save feedback
                  </Button>
                  <p>Remembered facts change only after you confirm a proposed correction.</p>
                </details>
                {item.todo_link ? (
                  <a href={item.todo_link.url} target="_blank" rel="noreferrer">
                    Open todo
                  </a>
                ) : outcome?.url ? (
                  <a href={outcome.url} target="_blank" rel="noreferrer">
                    Open todo
                  </a>
                ) : item.context === "Work" ? (
                  <Button variant="outline" disabled={busy || portalBusy} onClick={() => setEditingTodo(true)}>
                    Add to Team Portal
                  </Button>
                ) : item.context === "Unsorted" ? (
                  <p>Choose Work to add a Team Portal todo.</p>
                ) : null}
                {portalError && <p role="alert">{portalError}</p>}
                {outcome?.status === "uncertain" && (
                  <p role="status">
                    The task outcome is uncertain. Check Team Portal before trying again; the bridge will reconcile without posting again.
                  </p>
                )}
                {editingTodo && (
                  <div className="space-y-2 rounded border p-3">
                    <label className="block">
                      Todo title
                      <input
                        aria-label="Todo title"
                        className="w-full border bg-background p-2"
                        maxLength={240}
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          setPreview(null);
                        }}
                      />
                    </label>
                    <label className="block">
                      Todo details
                      <textarea
                        aria-label="Todo details"
                        className="w-full border bg-background p-2"
                        maxLength={8000}
                        value={details}
                        onChange={(e) => {
                          setDetails(e.target.value);
                          setPreview(null);
                        }}
                      />
                    </label>
                    <select
                      aria-label="Todo priority"
                      className="border bg-background"
                      value={priority}
                      onChange={(e) => {
                        setPriority(e.target.value);
                        setPreview(null);
                      }}
                    >
                      {["low", "medium", "high"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                    <p>Assigned to you. No deadline. Creating requires the confirmation below.</p>
                    <Button disabled={busy || portalBusy} onClick={() => void portal()}>
                      Preview todo
                    </Button>
                    {preview && (
                      <>
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(preview.payload, null, 2)}</pre>
                        <Button disabled={busy || portalBusy} onClick={() => void portal(true)}>
                          Confirm create todo
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingTodo(false);
                        setPreview(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                <AgentCorrections
                  memoName={memoName}
                  userName={userName}
                  version={item.state_version}
                  disabled={busy}
                  done={() => void query.refetch()}
                />
                <details>
                  <summary>Remember with guidance</summary>
                  <textarea
                    aria-label="Remember guidance"
                    maxLength={2000}
                    className="w-full border bg-background p-2"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button disabled={busy} onClick={() => mutation.mutate({ kind: "remember", note: comment })}>
                    Remember with guidance
                  </Button>
                </details>
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
