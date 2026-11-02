# 0002. The function dead-letters with a reason

- Status: accepted
- Date: 2026-11-01

## Context

Operators looking at the dead-letter queue need to know why each message is there, and a `404`
should not be retried for hours before anyone hears about it.

## Options

1. **The function sends** given-up messages to the dead-letter queue with `reason` and `attempts`
   attributes, and the queue's redrive policy stays as a safety net with a higher limit.
2. **Only the redrive policy**: report failures until `maxReceiveCount` is reached.

## Decision

Option 1, with `maxReceiveCount = MAX_ATTEMPTS + 2`.

- Permanent failures (`4xx` other than `408`/`425`/`429`, `3xx`, invalid job) are parked on the first
  attempt with their reason.
- The redrive policy cannot attach a reason and cannot tell permanent from transient failures.

## Consequences

- A failed send to the dead-letter queue must keep the message on the delivery queue (reported as a
  batch item failure). This is a tested guarantee.
- A message that crashes the function every time still reaches the dead-letter queue, without a
  reason, after `MAX_ATTEMPTS + 2` receives.
