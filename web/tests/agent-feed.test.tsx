import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AgentFeed from "@/components/AgentFeed";

vi.mock("@/connect", () => ({ getRequestToken: async () => "browser" }));
vi.mock("@/components/MemoView", () => ({ default: () => <p>Managed card</p> }));
afterEach(() => vi.unstubAllGlobals());
it("offers four views, preserves All notes and shows global status once", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("preferences")
              ? []
              : url.endsWith("feed/status")
                ? { warnings: ["Backlog pending"] }
                : { items: [], status: { warnings: ["Backlog pending"] } },
          ),
        ),
    ),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgentFeed userName="users/1">
        <p>Ordinary chronological notes</p>
      </AgentFeed>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Backlog pending")).toBeInTheDocument();
  for (const name of ["For you", "All", "Kept", "Remembered"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(screen.getByText("Ordinary chronological notes")).toBeInTheDocument();
  expect(screen.getAllByText("Backlog pending")).toHaveLength(1);
});

it("selects attention and FYI views, sends filters and resets them without affecting All", async () => {
  sessionStorage.clear();
  const requests: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      const url = new URL(path, "https://memos.test");
      requests.push(url);
      return new Response(JSON.stringify(url.pathname.endsWith("preferences") ? [] : { items: [], status: { warnings: [] } }));
    }),
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AgentFeed userName="users/filter-test">
        <p>Complete timeline</p>
      </AgentFeed>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("button", { name: "Needs attention" })).toHaveAttribute("aria-pressed", "true");
  await screen.findByText("No cards match this view. Try resetting filters or open All.");
  expect(requests.some((url) => url.searchParams.get("view") === "attention")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "FYI" }));
  expect(screen.getByRole("button", { name: "FYI" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText("Card type"), { target: { value: "insight" } });
  fireEvent.change(screen.getByLabelText("Urgency"), { target: { value: "high" } });
  fireEvent.change(screen.getByLabelText("Card context"), { target: { value: "Work" } });
  await vi.waitFor(() =>
    expect(
      requests.some(
        (url) =>
          url.searchParams.get("view") === "fyi" &&
          url.searchParams.get("kind") === "insight" &&
          url.searchParams.get("urgency") === "high" &&
          url.searchParams.get("context") === "Work",
      ),
    ).toBe(true),
  );
  expect(
    screen.getByText("Urgency filters show briefing cards with an explicit urgency; follow-ups have no urgency rating."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(screen.getByLabelText("Card type")).toHaveValue("all");
  expect(screen.getByLabelText("Urgency")).toHaveValue("all");
  expect(screen.getByLabelText("Card context")).toHaveValue("all");
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(screen.getByText("Complete timeline")).toBeInTheDocument();
  expect(screen.queryByLabelText("Card type")).not.toBeInTheDocument();
});

it("restores each user's selected view and filters", async () => {
  sessionStorage.clear();
  sessionStorage.setItem("agent-feed-view:users/restore", "for_you");
  sessionStorage.setItem(
    "agent-feed-filters:users/restore",
    JSON.stringify({ kind: "insight", urgency: "medium_high", context: "Family" }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("preferences") ? [] : { items: [], status: { warnings: [] } }))),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgentFeed userName="users/restore">
        <p>Timeline</p>
      </AgentFeed>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("button", { name: "For you" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Card type")).toHaveValue("insight");
  expect(screen.getByLabelText("Urgency")).toHaveValue("medium_high");
  expect(screen.getByLabelText("Card context")).toHaveValue("Family");
});

it("timestamps warnings with the recorded scan time rather than the current clock", async () => {
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("preferences")
              ? []
              : url.endsWith("feed/status")
                ? { warnings: ["Older scan warning"], generated_at: "2026-11-03T04:05:06+00:00" }
                : { items: [], status: { warnings: [] } },
          ),
        ),
    ),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgentFeed userName="users/log-time">
        <p>Timeline</p>
      </AgentFeed>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Older scan warning")).toBeVisible();
  expect(document.querySelector('time[datetime="2026-11-03T04:05:06+00:00"]')).toBeVisible();
});

it("starts a manual sync, prevents duplicate clicks and refreshes cards on completion", async () => {
  sessionStorage.clear();
  let started = false,
    syncReads = 0,
    feedReads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/sync")) {
        if (init?.method === "POST") {
          started = true;
          return new Response(JSON.stringify({ state: "pending", run_id: "manual" }), { status: 202 });
        }
        return new Response(
          JSON.stringify(
            started
              ? ++syncReads > 1
                ? { state: "done", run_id: "manual", published: 4 }
                : { state: "pending", run_id: "manual" }
              : { state: "idle" },
          ),
        );
      }
      if (path.includes("feed?")) feedReads++;
      return new Response(
        JSON.stringify(
          path.includes("preferences") ? [] : path.endsWith("feed/status") ? { warnings: [] } : { items: [], status: { warnings: [] } },
        ),
      );
    }),
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AgentFeed userName="users/manual-sync">
        <p>Timeline</p>
      </AgentFeed>
    </QueryClientProvider>,
  );
  await screen.findByText("No cards match this view. Try resetting filters or open All.");
  const initial = feedReads;
  fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
  expect(await screen.findByRole("button", { name: "Syncing…" })).toBeDisabled();
  await screen.findByText("Sync complete · 4 cards processed.", {}, { timeout: 5000 });
  await vi.waitFor(() => expect(feedReads).toBeGreaterThan(initial));
  expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
});
