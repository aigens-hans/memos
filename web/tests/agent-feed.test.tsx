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
