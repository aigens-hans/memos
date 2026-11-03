import { getRequestToken } from "@/connect";

export type AgentHandler = "learn_more" | "draft_reply";
export interface AgentItem {
  revision: string;
  memo_uid: string;
  state_version: number;
  kept: boolean;
  dismissed: boolean;
  memory_ids: string[];
  context: string;
  change_explanation?: string;
  todo_link?: { url: string; todo_id: string } | null;
  why?: { text: string; weight?: number }[];
  memo_content: string;
  decision: "pending" | "keep" | "remember" | "discard";
  warnings: string[];
  suggestions: { handler: AgentHandler; label: string; reason: string }[];
  jobs: { id: string; handler: AgentHandler; status: string; result: string | null }[];
}

export class AgentBridgeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function agentRequest<T>(memoName: string, suffix = "", body?: unknown, signal?: AbortSignal): Promise<T | null> {
  if (!/^memos\/[a-zA-Z0-9_-]{1,64}$/.test(memoName)) throw new Error("Invalid memo name");
  return bridgeRequest<T>(`${memoName}${suffix}`, body, signal);
}

export async function bridgeRequest<T>(path: string, body?: unknown, signal?: AbortSignal, method?: string): Promise<T | null> {
  const token = await getRequestToken();
  if (!token) throw new AgentBridgeError("Sign in again to use actions.", 401);
  const response = await fetch(`/api/agent-bridge/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });
  if (response.status === 404 && body === undefined) return null;
  if (!response.ok) {
    const message =
      response.status === 409
        ? "This item changed or an action already exists. Refresh before trying again."
        : response.status === 401
          ? "Sign in again to use actions."
          : "Actions are unavailable. Try again shortly.";
    throw new AgentBridgeError(message, response.status);
  }
  return response.json();
}
