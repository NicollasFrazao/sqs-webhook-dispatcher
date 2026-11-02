---
type: agent
name: Code Reviewer
description: Review a diff against the delivery guarantees, the signature contract, the layer rules and the quality gate
agentType: code-reviewer
phases: [R, V]
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Code reviewer

## Before approving

- The gate is green: `lint`, `typecheck`, `check:architecture`, `check:unused`, `test:coverage`,
  `synth`, `check:context`. The PR's Verification section states results ("95/95 tests"), not
  "tested".
- No new `eslint-disable` without a same-line reason; no new `TODO`; no lowered coverage threshold.

## Where bugs hide in this code

- **Acknowledging too early.** In `createDispatcher`, returning `null` deletes the message. Every
  path that returns `null` must have delivered or successfully dead-lettered. A `catch` that logs
  and returns `null` loses messages.
- **Classifying statuses.** A status moved from `rejected` to `retry` (or back) changes how long a
  broken receiver is hammered or how fast an operator hears about it. It must match the README table.
- **Attempt numbering.** `ApproximateReceiveCount` starts at 1; `retryDelaySeconds` throws below 1.
- **Delays.** Whole seconds, within `SQS_MAX_VISIBILITY_SECONDS`. A receiver's `Retry-After` does not
  go through `retryDelaySeconds` and is not clamped today (TD-08 in
  [tech-debt.md](../docs/tech-debt.md)).
- **The request contract.** Headers, body shape (`id`, `event`, `data`) and `t=…,v1=…` are what
  receivers verify. Any change there is a `!` commit and needs a new signature version.
- **Secrets and payloads in logs.** Neither may appear in a `log({...})` entry.
- **Infrastructure.** `maxReceiveCount` above `MAX_ATTEMPTS`; queue visibility at least six times the
  function timeout; grants instead of hand-written policies; named numbers.

## Layer checks a tool does not make

- New logic about HTTP answers belongs in `src/domain/delivery.ts`, not in the dispatcher.
- New AWS calls belong in `src/adapters/aws.ts` behind an interface the dispatcher owns.
