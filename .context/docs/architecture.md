---
type: doc
name: architecture
description: Modules and their import rules, delivery guarantees, the retry mechanism and the CDK stack
category: architecture
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Architecture

## Modules

```
src/domain/          pure rules, Node built-ins only
  backoff.ts         retryDelaySeconds: exponential backoff with full jitter, clamped to 12 h
  signature.ts       sign / verify: HMAC-SHA256 over `${timestamp}.${body}`
  delivery.ts        parseJob (validation) and deliver (one signed POST → DeliveryOutcome)
src/dispatcher.ts    createDispatcher: one SQS batch → partial batch failures
src/adapters/        the outside world behind the dispatcher's interfaces
  aws.ts             createSqsQueue (QueuePort on SQS), cachedSigningSecret (Secrets Manager)
  config.ts          loadSettings: environment → Settings
src/handler.ts       composition root: the only module that reads process.env and creates clients
infra/
  stack.ts           WebhookDispatcherStack: queues, function, secret, log group, alarm, outputs
  app.ts             CDK app entry point (`cdk.json` runs it with tsx)
```

## Layer rules

Enforced by `npm run check:architecture` (`.dependency-cruiser.cjs`):

| Rule | Why |
| --- | --- |
| `src/domain/` imports only `src/domain/` and Node built-ins | The delivery rules are tested without AWS, network or clock |
| `src/dispatcher.ts` imports only `src/domain/` (and the Lambda event **types**) | It talks to SQS through `QueuePort`; tests fake two methods instead of mocking the SDK |
| Nothing imports `src/handler.ts` | It is the composition root; importing it would read the environment and create clients |
| `src/` and `infra/` never import each other | The stack points at `src/handler.ts` by path for bundling; runtime and infrastructure code stay separate |
| `src/` and `infra/` never import `test/`; `src/` uses no devDependency at run time | The bundle must be self-contained |
| No cycles, no orphan modules (entry points excepted), no unresolvable imports | Load order must not matter; dead files are found |

## Guarantees

These hold for every record and every change must keep them (the tests in `test/dispatcher.test.ts`
encode them):

1. A record is **removed** from the queue (not reported as failed) only when it was delivered or
   successfully sent to the dead-letter queue.
2. If sending to the dead-letter queue **fails**, the record is reported as a batch item failure and
   comes back. Never drop a message that could not be parked.
3. If setting the retry delay fails, the record is **still** reported as failed; it comes back after
   the queue's default visibility timeout instead of the backoff delay.
4. A record is handled on its own: one bad record never fails the whole batch.
5. The signing secret is read once per container; a failed read is not cached.

## Why retries use the visibility timeout

See [ADR 0001](adr/0001-retry-with-visibility-timeout.md). A failed record is not re-enqueued: the
dispatcher calls `ChangeMessageVisibility` with the backoff delay and reports the record in
`batchItemFailures`. SQS hands it back when the delay ends and increments `ApproximateReceiveCount`,
which is the attempt number. No scheduler, no second queue, no state of our own.

## Dead-lettering from code

See [ADR 0002](adr/0002-dead-letter-from-code.md). The function sends given-up messages to the
dead-letter queue itself, with a `reason` and `attempts` message attribute. The queue's redrive
policy (`maxReceiveCount = maxAttempts + 2`) remains as a safety net for messages that crash the
function before it can decide.

## The stack (`infra/stack.ts`)

- Delivery queue: visibility timeout six times the function timeout (AWS guidance for SQS event
  sources), 4 days retention, SSE-SQS, redrive to the dead-letter queue as a safety net.
- Dead-letter queue: 14 days retention, SSE-SQS, a CloudWatch alarm at one visible message.
- Function: Node.js 22, arm64, 256 MB, 30 s timeout, ESM bundle with source maps; event source with
  batches of 10, 1 s batching window, `reportBatchItemFailures` and maximum concurrency 10.
- Signing secret: generated 48-character key, retained when the stack is deleted.
- IAM by grants only: consume the delivery queue, send to the dead-letter queue, read the secret.
