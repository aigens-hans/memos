import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { type AgentItem, agentRequest } from "@/lib/agent-bridge";

type Action =
  | { kind: "decision"; revision: string; decision: AgentItem["decision"] }
  | { kind: "job"; revision: string; handler: "learn_more" | "draft_reply"; question: string };

export function useAgentActions(memoName: string, userName: string, memoContent: string) {
  const client = useQueryClient();
  const queryKey = ["agent-actions", userName, memoName];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => agentRequest<AgentItem>(memoName, "", undefined, signal),
    retry: false,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.jobs.some((job) => ["queued", "running"].includes(job.status)) ? 5_000 : false),
  });
  const publishedContent = query.data?.memo_content;
  useEffect(() => {
    if (publishedContent !== undefined && publishedContent !== memoContent) {
      void client.invalidateQueries({ queryKey: ["memos"] });
    }
  }, [client, memoContent, publishedContent]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (action: Action) => {
      if (action.kind === "decision") {
        return agentRequest<AgentItem>(memoName, "/decisions", { revision: action.revision, decision: action.decision });
      }
      await agentRequest(memoName, "/jobs", { revision: action.revision, handler: action.handler, question: action.question });
      return undefined;
    },
    onSuccess: (data) => {
      if (data !== undefined) client.setQueryData(queryKey, data);
      void client.invalidateQueries({ queryKey });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey });
    },
  });
  return { query, mutation };
}
