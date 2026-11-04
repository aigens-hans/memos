# Briefing Cards Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for native implementation with one independent final review.

**Goal:** Deploy readable briefing cards while preserving existing privacy and action flows.
**Architecture:** AgentBriefingCard renders authorized live memo-backed data and reuses MemoAgentActions in briefing presentation. AgentFeed integrates it without changing All or Remembered.
**Tech Stack:** Existing React, TypeScript, Tailwind, React Query, Vitest and lucide icons.
**Spec:** docs/design/2026-11-03-briefing-cards.md

## Global Constraints
- No new dependencies, API/auth changes, model calls or backend migrations.
- Never fabricate dates, metrics, chart points or urgency.
- Preserve native blurred/changed-memo behavior and independent action state.
- Preserve explicit Portal confirmation and existing default-profile Learn more API routing.

## Review Focus
- Source changes, public/foreign/deleted memos and hidden-tag content cannot leak stored summaries.
- Narrow mobile layouts and long Unicode summaries remain readable.
- Hidden advanced controls remain discoverable and keyboard-operable.
- Research/draft results and status remain visible without duplicate action controls.
- Filtering must not hide unloaded candidates or interfere with existing All/Remembered views.

### Task 1: Briefing cards and action presentation
- [ ] Run new card tests first; expect missing component failure.
- [ ] Add typed optional content fields, source-backed card component, contextual styling and native privacy fallbacks.
- [ ] Add briefing presentation to existing action component with primary draft/learn action, quiet saves and folded advanced controls/results.
- [ ] Integrate into AgentFeed and run focused action/card/feed tests.

### Task 2: Integration and review
- [ ] Add regressions for privacy, stale content, full-source expansion, action visibility and Work-only todo confirmation.
- [ ] Run frontend test suite, lint and enabled production build.
- [ ] Obtain one independent whole-change review, fix material findings with regressions, commit.

### Task 3: Release
- [ ] Copy versioned production build to immutable UI release.
- [ ] Back up and switch gateway static root, validate and restart only gateway.
- [ ] Verify HTTPS HTML/assets, owner feed and private access; record rollback and push/link PR.
