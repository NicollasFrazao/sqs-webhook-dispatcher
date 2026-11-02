---
type: skill
name: Code Review
description: Review a change in this repository against its delivery guarantees and gate. Use when reviewing a pull request or a local diff before merge
skillSlug: code-review
phases: [R, V]
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Code review

1. Run the gate on the branch, one command at a time: `npm run lint`, `npm run typecheck`,
   `npm run check:architecture`, `npm run check:unused`, `npm run test:coverage`, `npm run synth`,
   `npm run check:context`. Record the numbers.
2. Read the diff domain first, then `src/dispatcher.ts`, adapters, `infra/`. For every path in the
   dispatcher, write down what happens to the message (delivered, retried, parked, kept) and compare
   with the guarantees in [architecture.md](../../docs/architecture.md). Use the list in
   [agents/code-reviewer.md](../../agents/code-reviewer.md).
3. Check the docs moved with the code: TSDoc on new exports (lint enforces presence, not accuracy),
   the README's outcome and configuration tables, `.context/docs` when a rule or a module changed.
4. Report findings with file and line, the failure scenario, and a fix. Separate blockers from
   suggestions.
