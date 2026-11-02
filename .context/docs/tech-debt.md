---
type: doc
name: tech-debt
description: Known gaps, with the reason each is still open
category: debt
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Technical debt

Known gaps, each a decision with a reason. When one is picked up, it becomes an issue and its number
goes here.

| Id | Gap | Why it is open | What closes it |
| --- | --- | --- | --- |
| TD-01 | No per-endpoint circuit breaker: one dead receiver uses retries and concurrency | Bounded by `maxConcurrency` and backoff; README "Possible next steps" | Per-host failure counter (DynamoDB) checked before `deliver` |
| TD-02 | No redrive tooling for the dead-letter queue | The SQS console's redrive works for now | A script or Lambda that moves messages back, filtered by `reason` |
| TD-03 | No delivery log for customers | Out of scope for the dispatcher core | DynamoDB table written per outcome, read by an API |
| TD-04 | Signing key rotation has no overlap | Single `v1` key; receivers must switch at once | Two keys in the secret, `v1` sent for both during a window |
| TD-05 | SSRF towards private addresses is not blocked | The function runs outside a VPC; queue access is the control | Resolve the host and refuse private ranges before `fetch` |
| TD-06 | Moderate `minimatch` advisory in dev-only tooling (eslint, typescript-eslint, aws-cdk-lib's bundled copy) | Below the `high` gate and not in the bundle; the fix is upstream | Dependabot updates when upstream releases |
| TD-07 | Branch ruleset must list the new CI jobs | Job names changed in the engineering-standards PR | Repository settings (see CONTRIBUTING.md) |
| TD-08 | A `Retry-After` above 12 hours is not clamped: `ChangeMessageVisibility` rejects it, the failure is logged, and the retry happens after the queue's default visibility timeout instead | Found while documenting; the message is not lost, and changing it is a behaviour change outside the standards work | Clamp `retryAfterSeconds` to `SQS_MAX_VISIBILITY_SECONDS` in the dispatcher, with a test |
