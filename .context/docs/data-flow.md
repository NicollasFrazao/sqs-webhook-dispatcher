---
type: doc
name: data-flow
description: A job from SendMessage to the receiver, the retry loop and the dead-letter queue
category: data-flow
generated: 2026-11-01
status: filled
scaffoldVersion: "2.0.0"
---

# Data flow

## Happy path

1. The sender calls `SendMessage` on the delivery queue with a JSON body
   `{ deliveryId, url, event, payload }`.
2. The SQS event source invokes the function with up to 10 records (1 s batching window), at most
   10 invocations at a time.
3. `createDispatcher` (`src/dispatcher.ts`) reads the signing secret once for the batch
   (`cachedSigningSecret`, once per container) and handles every record in parallel.
4. For each record: `parseJob` validates the body; the attempt number is
   `ApproximateReceiveCount`.
5. `deliver` (`src/domain/delivery.ts`) POSTs `{"id","event","data"}` with `X-Webhook-Id`,
   `X-Webhook-Event`, `X-Webhook-Attempt` and `X-Webhook-Signature: t=<unix>,v1=<hex>`, a timeout
   of `REQUEST_TIMEOUT_MS` and `redirect: 'manual'`.
6. `2xx` → logged as `delivered`; the record is not reported, so Lambda deletes it.

## Retry loop

```
receiver 5xx / 408 / 425 / 429 / timeout / network error
  └─ attempt < MAX_ATTEMPTS
       ├─ delay = Retry-After (seconds) ?? retryDelaySeconds(attempt, backoff, random)
       ├─ ChangeMessageVisibility(receiptHandle, delay)      (failure only logged)
       └─ report { itemIdentifier: messageId } in batchItemFailures
            └─ SQS makes the message visible after `delay`; ApproximateReceiveCount + 1
```

## Giving up

```
invalid job | other 4xx | 3xx | attempt >= MAX_ATTEMPTS
  └─ SendMessage to the dead-letter queue
       (same body, attributes reason ≤ 1024 chars and attempts)
       ├─ ok     → logged `dead-lettered`; record not reported → deleted
       └─ failed → logged `dead-letter failed`; record reported → comes back
```

Safety net: after `MAX_ATTEMPTS + 2` receives, the queue's redrive policy moves the message to the
dead-letter queue without a reason attribute. That only happens if the function keeps crashing.

## Logs

One JSON line per outcome on stdout (CloudWatch Logs, 1 month retention): `level`, `msg`
(`delivered`, `retry scheduled`, `could not set retry delay`, `dead-lettered`, `dead-letter failed`),
`deliveryId`, `event`, `attempt`, and `status`, `reason` or `delaySeconds` as relevant. The payload
is never logged.

## Alarm

`DeadLettersAlarm` fires when the dead-letter queue has at least one visible message over a 5-minute
period. Inspect the `reason` attribute, fix the cause, and move the messages back with the SQS
console's redrive (no tooling here yet, see [tech-debt.md](tech-debt.md)).
