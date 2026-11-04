# Optional inline agent actions

Build the frontend with `VITE_AGENT_BRIDGE_ENABLED=true` to enable controls for private, owner-managed memos containing a bridge publication marker. Leave the flag unset for stock rendering. No Go authentication or release behavior is changed.

A separately deployed same-origin service implements `/api/agent-bridge/memos/{uid}`. Browser calls reuse `getRequestToken()`; credentials for backend workers stay on the server. The service verifies the current Memos identity and private ownership for every request.

GET returns `{ revision, memo_content, decision, warnings, suggestions, jobs }`. Controls stay disabled until `memo_content` equals the content displayed by the card; mismatches invalidate Memos queries. Decisions POST to `/decisions` with `{ revision, decision }`; jobs POST to `/jobs` with `{ revision, handler, question }`. Conflicts return 409 and trigger a refresh. Decisions are `pending`, `keep`, `remember`, `discard`. Initial handlers are `learn_more` and `draft_reply`.

Keep and Remember persist review choices. Discard collapses content to an Undo control. Learn more and suggested actions expand instructions inside the card, then queue a job. Queued jobs poll every five seconds; results render as plain text. Drafting does not send messages. Unsupported generated action handlers are not rendered.

The server contract must deduplicate requests, freeze job input, validate revisions and displayed memo snapshots, reject cross-owner/public access, and retain decisions across partial scans. Ordinary memos, editing, read-only cards and unrevealed blurred content use the existing body.

Run `pnpm lint`, `pnpm test`, and `VITE_AGENT_BRIDGE_ENABLED=true pnpm build` before deployment. Gateway and worker configuration belong in private deployment infrastructure.
