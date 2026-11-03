# Briefing cards

The user accepted the interactive magazine-style mockup as close to the intended direction and explicitly authorized implementation and deployment. Make the existing For you and Kept feeds easier to scan without changing source data, model routing or durable actions.

Use a clear headline, short summary, contextual card-type icon/accent, quiet source/context/date metadata and expandable source details. Use existing classification and source fields only; do not fabricate trend values, deadlines, people, urgency or meeting times from prose. Keep Learn more visible, with the selected draft suggestion prominent when applicable. Keep and Remember remain independent; Dismiss, context overrides, corrections, guidance and the Work-only Portal confirmation remain accessible. Fold advanced controls and long research results away until requested. All retains the native chronological memo interface and Remembered retains its editable memory interface.

Approaches: a native briefing-card wrapper reusing the existing action component is chosen over a separate app or another task manager. It preserves all API contracts and avoids duplicating write logic. Native MemoView remains the fallback for changed/blurred content; never reveal a stored summary over an unreadable, foreign, public or blurred memo. No new dependencies, authentication changes or backend migrations.

Deployment uses the existing immutable frontend release and gateway static-root switch with a rollback copy. No production backend, summarizer or Hermes changes.
