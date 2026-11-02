---
type: doc
name: project-overview
description: What the dispatcher does, for whom, and what it deliberately leaves out
category: overview
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Project overview

`sqs-webhook-dispatcher` delivers webhooks reliably on **AWS Lambda + SQS**. An application drops a
job on a queue and moves on; the dispatcher POSTs it to the customer's URL, signs every request,
retries with exponential backoff when the receiver is down, and parks what cannot be delivered in a
dead-letter queue with the reason attached and an alarm watching it.

## Who uses it

- **Senders**: the application that enqueues jobs (`deliveryId`, `url`, `event`, `payload`). It never
  waits for the receiver and never retries by itself.
- **Receivers**: the customers' endpoints. They get a signed `POST` with stable `X-Webhook-Id`
  across retries, verify it with `verify` (shipped in `src/domain/signature.ts`) and deduplicate.
- **Operators**: whoever deploys the stack and watches the dead-letter alarm.

## What it guarantees

- **At-least-once delivery.** A message leaves the queue only when it was delivered (`2xx`) or
  parked in the dead-letter queue with a reason. If parking fails, it stays on the queue.
- **Retries only when they can succeed**: `5xx`, `408`, `425`, `429`, timeouts and network errors.
  Any other `4xx`, a `3xx` or an invalid job goes straight to the dead-letter queue.
- **Spaced retries** (exponential backoff with full jitter, `Retry-After` in seconds wins) without a
  scheduler, using the message's visibility timeout.
- **Bounded pressure**: at most 10 concurrent invocations against receivers.
- **Authenticity and freshness**: HMAC-SHA256 over `timestamp.body`, five-minute tolerance.

## What it deliberately does not do

- No per-endpoint circuit breaker, no redrive tooling, no delivery log for customers (README,
  "Possible next steps"; [tech-debt.md](tech-debt.md)).
- No ordering: SQS standard queues and parallel records mean deliveries can arrive out of order.
- No exactly-once: receivers deduplicate on `X-Webhook-Id`.
- No HTTP API to enqueue: senders use `SendMessage` with their own IAM permissions.

## Stack

TypeScript (strict, ESM, Node.js 22), AWS SDK v3 (SQS, Secrets Manager), AWS CDK v2 with
`NodejsFunction` (esbuild, arm64), Vitest. See [tooling.md](tooling.md) for the quality tooling.
