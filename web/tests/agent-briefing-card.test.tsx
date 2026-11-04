import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AgentBriefingCard from "@/components/AgentBriefingCard";
import type { AgentItem } from "@/lib/agent-bridge";

vi.mock("@/connect", () => ({ getRequestToken: async () => "browser" }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userTagsSetting: {} }) }));
vi.mock("@/lib/tag", () => ({ isMemoBlurred: () => blurred }));
vi.mock("@/hooks/useMemoQueries", () => ({ memoDetailQueryOptions: () => ({ queryKey: ["synthetic-memo"], queryFn: async () => memo }) }));
vi.mock("@/components/MemoView", () => ({ default: () => <p>Native protected memo view</p> }));
let blurred = false;
let memo: Record<string, unknown>;
const item = {
  key: "synthetic:action:a",
  memo_uid: "abc",
  revision: "r",
  state_version: 1,
  kept: false,
  dismissed: false,
  memory_ids: [],
  context: "Work",
  memo_content: "Original full source detail",
  decision: "pending",
  warnings: [],
  suggestions: [{ handler: "draft_reply", label: "Draft reply", reason: "Check progress" }],
  jobs: [],
  content: {
    headline: "Confirm the vendor meeting",
    summary: "Two times were discussed. Confirm the agreed time.",
    source: "synthetic",
    chat: "Vendor team",
  },
} satisfies AgentItem;
function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AgentBriefingCard item={item} userName="users/1" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  blurred = false;
  memo = { name: "memos/abc", creator: "users/1", visibility: 1, content: item.memo_content };
  vi.stubEnv("VITE_AGENT_BRIDGE_ENABLED", "true");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => new Response(JSON.stringify(String(input).endsWith("/corrections") ? [] : item))),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("shows a scannable headline and summary, with full source folded away", async () => {
  mount();
  expect(await screen.findByRole("heading", { name: "Confirm the vendor meeting" })).toBeInTheDocument();
  expect(screen.getByText("Two times were discussed. Confirm the agreed time.")).toBeVisible();
  expect(screen.getByText("Original full source detail")).not.toBeVisible();
  fireEvent.click(screen.getByText("Source & details"));
  expect(screen.getByText("Original full source detail")).toBeVisible();
  expect(await screen.findByRole("button", { name: "Learn more" })).toBeVisible();
});
it("does not expose stored summaries when the upstream memo changed", async () => {
  memo.content = "New owner text";
  mount();
  expect(await screen.findByText("Native protected memo view")).toBeInTheDocument();
  expect(screen.queryByText("Confirm the vendor meeting")).not.toBeInTheDocument();
});
it("preserves native content blurring instead of showing an unblurred summary", async () => {
  blurred = true;
  mount();
  expect(await screen.findByText("Native protected memo view")).toBeInTheDocument();
  expect(screen.queryByText("Confirm the vendor meeting")).not.toBeInTheDocument();
});
it("does not render a card that has become public or belongs to another user", async () => {
  memo.visibility = 2;
  await act(async () => {
    mount();
  });
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("does not expose stored card text for a foreign memo", async () => {
  memo.creator = "users/other";
  await act(async () => {
    mount();
  });
  expect(screen.queryByText("Confirm the vendor meeting")).not.toBeInTheDocument();
});

it("does not revive a deleted memo from the feed snapshot", async () => {
  memo = null as unknown as Record<string, unknown>;
  await act(async () => {
    mount();
  });
  expect(screen.queryByText("Confirm the vendor meeting")).not.toBeInTheDocument();
});

it("shows the actual group sender and exact sent timestamp instead of only activity date", async () => {
  const card = {
    ...item,
    content: {
      ...item.content,
      chat: "Operations group",
      source_message_sender: "Sam Chen",
      source_message_sent_at: "2026-11-04T01:15:23+00:00",
      last_activity: "2026-11-04T08:00:00+00:00",
    },
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgentBriefingCard item={card} userName="users/1" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Sam Chen")).toBeVisible();
  const time = document.querySelector('time[datetime="2026-11-04T01:15:23+00:00"]');
  expect(time).toBeVisible();
  expect(time).toHaveAttribute("title");
  expect(screen.getByText(/Operations group/)).toBeVisible();
});

it("labels legacy attribution as unavailable instead of inventing a sender", async () => {
  mount();
  expect(await screen.findByText("Sender unavailable")).toBeVisible();
  expect(screen.getByText("Sent time unavailable")).toBeVisible();
});

it.each([
  ["whatsapp", "WhatsApp"],
  ["slack", "Slack"],
  ["zoho_cliq", "Zoho Cliq"],
  ["gmail_work", "Email · Work"],
  ["gmail_personal", "Email · Personal"],
  ["gmail", "Email"],
  ["email", "Email"],
  ["future_platform", "future platform"],
  [undefined, "Unknown source"],
])("identifies the card source accessibly for %s without losing its conversation", async (source, label) => {
  const content: Record<string, string> = { ...item.content };
  if (source) content.source = source;
  else delete content.source;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgentBriefingCard item={{ ...item, content }} userName="users/1" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("img", { name: `Source: ${label}` })).toBeVisible();
  expect(screen.getByText("Vendor team")).toBeVisible();
});
