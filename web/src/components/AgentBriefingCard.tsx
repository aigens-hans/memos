import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Bell, Lightbulb, MessageSquare } from "lucide-react";
import MemoAgentActions from "@/components/MemoAgentActions";
import MemoView from "@/components/MemoView";
import { useAuth } from "@/contexts/AuthContext";
import { memoDetailQueryOptions } from "@/hooks/useMemoQueries";
import type { AgentItem } from "@/lib/agent-bridge";
import { isMemoBlurred } from "@/lib/tag";
import { Visibility } from "@/types/proto/api/memo_service_pb";

function presentation(item: AgentItem) {
  if (item.content?.urgency === "high")
    return {
      label: "Needs attention",
      Icon: Bell,
      accent: "border-l-amber-500",
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  if (item.key?.includes(":action:") || item.suggestions.some((s) => s.handler === "draft_reply"))
    return {
      label: "Follow-up",
      Icon: MessageSquare,
      accent: "border-l-blue-500",
      badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    };
  return {
    label: "Update",
    Icon: Lightbulb,
    accent: "border-l-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
}

export default function AgentBriefingCard({ item, userName }: { item: AgentItem; userName: string }) {
  const memo = useQuery(memoDetailQueryOptions(`memos/${item.memo_uid}`));
  const { userTagsSetting } = useAuth();
  if (memo.isError)
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        Could not load this memo.{" "}
        <a className="underline" href={`/memos/${item.memo_uid}`}>
          Open memo
        </a>
      </p>
    );
  if (!memo.data) return null;
  if (memo.data.creator !== userName || memo.data.visibility !== Visibility.PRIVATE) return null;
  if (memo.data.content !== item.memo_content || isMemoBlurred(memo.data, userTagsSetting))
    return <MemoView memo={memo.data} showVisibility />;
  const content = item.content ?? {};
  const title = content.headline || content.summary || "Message update";
  const summary = content.detail || (content.summary !== title ? content.summary : "") || content.last_message_excerpt || "";
  const type = presentation(item);
  const activity = content.last_activity ? new Date(content.last_activity) : null;
  const date =
    activity && !Number.isNaN(activity.getTime()) ? activity.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  const source = [content.source?.replaceAll("_", " "), content.chat].filter(Boolean).join(" · ");
  const fullText = memo.data.content.replace(/\[\/\/\]: # \(agent-bridge:[^\n]*\)/g, "").trim();
  return (
    <article aria-label={title} className={`overflow-hidden rounded-2xl border border-l-[3px] ${type.accent} bg-card p-4 shadow-sm sm:p-5`}>
      <MemoAgentActions
        memoName={memo.data.name}
        memoContent={memo.data.content}
        userName={userName}
        presentation="briefing"
        explanations={item.why}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${type.badge}`}
          >
            <type.Icon size={12} aria-hidden="true" />
            {type.label}
          </span>
          <span>{item.context}</span>
          <span className="min-w-0 break-words sm:ml-auto">
            {source}
            {date && ` · ${date}`}
          </span>
        </div>
        <h2 className="line-clamp-2 break-words text-lg font-semibold leading-snug tracking-tight sm:text-xl">{title}</h2>
        {summary && (
          <p className="mt-2 line-clamp-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{summary}</p>
        )}
        {item.change_explanation && (
          <p className="mt-3 rounded-lg bg-primary/5 p-3 text-xs">
            <span className="font-semibold">What changed · </span>
            {item.change_explanation}
          </p>
        )}
        <details className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">Source &amp; details</summary>
          <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed">{fullText}</p>
          <p className="mt-3">AI-generated summary from your messages. Check the source before acting on uncertain details.</p>
          <a className="mt-2 inline-flex items-center gap-1 underline" href={`/memos/${item.memo_uid}`}>
            Open source memo <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </details>
      </MemoAgentActions>
    </article>
  );
}
