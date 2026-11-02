---
type: skill
name: Commit Message
description: Write a Conventional Commits message that passes commitlint and states the right version bump. Use when committing in this repository
skillSlug: commit-message
phases: [E, C]
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Commit message

Format, checked by commitlint (`@commitlint/config-conventional`) in the `commit-msg` hook and in CI:

```
type(scope): imperative summary in lower case, no period

Why the change was needed and what it does, wrapped at 72 columns.

Closes #12
```

- **type decides the version**: `feat` (minor), `fix` / `perf` / `refactor` (patch), `!` or a
  `BREAKING CHANGE:` footer (major); `docs`, `test`, `build`, `ci`, `chore`, `style` release nothing.
  Use `!` only when a sender or receiver integration breaks (job format, headers, signature).
- **scope** is optional and names an area: `domain`, `dispatcher`, `adapters`, `infra`, `lint`,
  `context`, `ci`.
- The body explains why; the diff already shows what.
- English only. One concern per commit; a refactor and a behaviour change are two commits.

Examples:

```
feat: webhook dispatcher on AWS Lambda + SQS
fix(infra): encrypt both queues with SQS-managed keys
build: check the layer rules with dependency-cruiser
```
