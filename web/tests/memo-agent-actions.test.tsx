import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoAgentActions from "@/components/MemoAgentActions";

vi.mock("@/connect", () => ({ getRequestToken: async () => "browser" }));
const item = {
  revision: "r1",
  memo_content: "Original memo",
  decision: "pending",
  state_version: 1,
  kept: false,
  dismissed: false,
  memory_ids: [],
  context: "Work",
  content: { source: "synthetic" },
  warnings: ["Scan incomplete"],
  suggestions: [{ handler: "draft_reply", label: "Draft reply", reason: "A reply is waiting" }],
  jobs: [],
};
let state: Record<string, unknown>;
let requests: { url: string; body: Record<string, string> }[];

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoAgentActions memoName="memos/abc" userName="users/1" memoContent="Original memo">
        <p>Original memo</p>
      </MemoAgentActions>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_AGENT_BRIDGE_ENABLED", "true");
  state = structuredClone(item);
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        const body = JSON.parse(options.body as string);
        requests.push({ url, body });
        if (url.endsWith("/feedback")) {
          if (body.action === "keep") state.kept = true;
          if (body.action === "dismiss") state.dismissed = true;
          if (body.action === "undo_dismiss") state.dismissed = false;
        }
        if (url.endsWith("/remember")) state.memory_ids = ["memory1"];
        if (url.endsWith("/jobs")) state.jobs = [{ id: "j1", handler: body.handler, status: "queued", result: null }];
      }
      return new Response(JSON.stringify(url.endsWith("/corrections") ? [] : state), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("inline agent actions", () => {
  it("leaves the memo untouched and makes no request when disabled", () => {
    vi.stubEnv("VITE_AGENT_BRIDGE_ENABLED", "false");
    mount();
    expect(screen.getByText("Original memo")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Keep" })).not.toBeInTheDocument();
  });

  it("shows AI rationale and partial warnings and persists Remember", async () => {
    mount();
    expect(await screen.findByText("A reply is waiting")).toBeInTheDocument();
    expect(screen.getByText("Scan incomplete")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remember" }));
    expect(await screen.findByText("Remembered with source and context")).toBeInTheDocument();
    expect(requests[0].url).toMatch(/remember$/);
    expect(requests[0].body).toMatchObject({ revision: "r1", state_version: 1 });
  });

  it("collapses discarded content and supports undo", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm dismiss" }));
    await waitFor(() => expect(screen.queryByText("Original memo")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Original memo")).toBeInTheDocument();
    expect(requests.at(-1)?.body.action).toBe("undo_dismiss");
  });

  it("queues research with an optional question and shows results inline", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Learn more" }));
    fireEvent.change(screen.getByLabelText("Question or instructions"), { target: { value: "What changed?" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue research" }));
    expect(await screen.findByText("Research queued")).toBeInTheDocument();
    expect(requests[0].body).toEqual({ revision: "r1", handler: "learn_more", question: "What changed?" });
    state.jobs = [{ id: "j1", handler: "learn_more", status: "done", result: "Synthetic findings" }];
    // A fresh mount simulates revisiting the feed after the agent returns.
    mount();
    expect(await screen.findByText("Synthetic findings")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });

  it("keeps content visible and reports a stale action", async () => {
    mount();
    await screen.findByRole("button", { name: "Keep" });
    vi.mocked(fetch).mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: "This item changed. Refresh before choosing an action." }), { status: 409 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This item changed");
    expect(screen.getByText("Original memo")).toBeInTheDocument();
  });

  it("does not hide memo content if the bridge is unavailable", async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response("", { status: 503 }));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Actions are unavailable");
    expect(screen.getByText("Original memo")).toBeInTheDocument();
  });
  it("blocks actions when bridge state is newer than the displayed memo", async () => {
    state.memo_content = "New memo text";
    state.revision = "r2";
    mount();
    expect(await screen.findByRole("button", { name: "Keep" })).toBeDisabled();
    expect(screen.getByText("Original memo")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Updating memo content");
  });
});
