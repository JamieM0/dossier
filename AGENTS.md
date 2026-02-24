# Agent Workflow Requirements

This repository is a desktop-only app. Treat visual QA as desktop-only unless the user explicitly asks for mobile.

## Mandatory After Every Visual Change

When any UI, layout, style, spacing, typography, interaction copy, or visual behavior changes:

1. Run automated Playwright visual review.
2. Capture fresh artifacts (full-page + focused screenshots and structured audit output).
3. Review artifacts and list UI/UX issues by severity.
4. Fix every issue identified in that review by default.
5. Re-run the same visual review and verify issues are resolved.

Do not leave visual issues unfixed unless the user explicitly instructs otherwise.

## Default Command

Use:

`pnpm --filter @dossier/e2e test -- specs/welcome-llm-review.spec.ts`

If the scope changes, add/update Playwright specs so the affected UI is covered with the same review-fix-recheck loop.
