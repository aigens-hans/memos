# Briefing cards

Status: Implemented

The user accepted the interactive magazine-style mockup as close to the intended direction and explicitly authorized implementation and deployment. Make the existing For you and Kept feeds easier to scan without changing source data, model routing or durable actions.

Use a clear headline, short summary, contextual card-type icon/accent, quiet source/context/date metadata and expandable source details. Use existing classification and source fields only; do not fabricate trend values, deadlines, people, urgency or meeting times from prose. Keep Learn more visible, with the selected draft suggestion prominent when applicable. Keep and Remember remain independent; Dismiss, context overrides, corrections, guidance and the Work-only Portal confirmation remain accessible. Fold advanced controls and long research results away until requested. All retains the native chronological memo interface and Remembered retains its editable memory interface.

Approaches: a native briefing-card wrapper reusing the existing action component is chosen over a separate app or another task manager. It preserves all API contracts and avoids duplicating write logic. Native MemoView remains the fallback for changed/blurred content; never reveal a stored summary over an unreadable, foreign, public or blurred memo. No new dependencies, authentication changes or backend migrations.

Deployment uses the existing immutable frontend release and gateway static-root switch with a rollback copy. No production backend, summarizer or Hermes changes.

## Feed filtering (2026-11-04)

Needs attention includes follow-ups and medium/high urgency briefings; FYI includes low-urgency briefings. For you preserves personalized ranking. Card type, explicit briefing urgency and context can be selected on card feeds; selections persist per user for the browser session. Urgency-specific filters exclude follow-ups without an urgency rating. All and Remembered remain their native interfaces. New sessions default to Needs attention; saved view choices are preserved.

The bridge applies predicates before pagination and binds snapshots to every selection. Live privacy and membership checks remain authoritative. Views change presentation only: they do not delete memos, change Keep/Dismiss feedback or infer resolution. The summarizer separately checks later conversation evidence before treating an obligation or escalation as open. Existing cards remain available until explicitly dismissed; missing from a later scan is not proof of completion.

## Relative times (2026-11-04)

Source-message times, reported activity and coverage-warning scan times display relative ages using the existing auto-updating RelativeTime component with relative format. The exact local date, time and timezone remain on the enclosing time element's hover title and the original ISO value remains in datetime. Missing source/scan times still show unavailable; polling does not reset warning ages.
