# 0001. Space retries with the message's visibility timeout

- Status: accepted
- Date: 2026-11-01

## Context

A failed delivery must be retried later, with a delay that grows per attempt, without losing the
message and without running a scheduler.

## Options

1. **Change the visibility timeout** of the received message to the delay and report it as a
   partial batch failure; SQS hands it back when the delay ends.
2. **Re-enqueue** a copy with `DelaySeconds` and delete the original.
3. **Step Functions** or EventBridge Scheduler per retry.

## Decision

Option 1.

- No new message: the attempt count comes from `ApproximateReceiveCount`, the same message id is
  kept, and nothing is lost between a send and a delete.
- Option 2 caps the delay at 15 minutes and needs a send and a delete that can half-fail.
- Option 3 adds a service and a cost per retry for what SQS already does.

## Consequences

- The longest delay is SQS's 12-hour visibility limit (`SQS_MAX_VISIBILITY_SECONDS`).
- If `ChangeMessageVisibility` fails, the message still comes back, after the queue's default
  visibility timeout (six times the function timeout).
- The redrive policy counts these receives, so `maxReceiveCount` must stay above `MAX_ATTEMPTS`
  (see ADR 0002).
