# 0003. Exponential backoff with full jitter

- Status: accepted
- Date: 2026-11-01

## Context

After a receiver's outage, every queued delivery for it fails at once. Retrying them on the same
schedule hits the receiver with the whole backlog again when it comes back.

## Options

1. **Full jitter**: delay uniformly random in `[0, min(max, base · 2^(attempt-1))]`.
2. **Equal jitter** or **decorrelated jitter**.
3. **Fixed exponential** without jitter.

## Decision

Option 1, with the receiver's `Retry-After` (delay-seconds form only) taking precedence.

- Full jitter spreads load best for the least code (AWS Architecture Blog, "Exponential Backoff And
  Jitter"); randomness is injected, so tests stay deterministic.
- An HTTP-date `Retry-After` falls back to the policy, avoiding clock-skew handling.

## Consequences

- A retry can happen almost immediately (delay 0); the attempt budget, not the delay, bounds the
  total effort.
- The total waiting time before giving up is random; with the defaults (30 s base, 1 h cap,
  8 attempts) the seven delays add up to at most 3,810 s (about 64 minutes), unless the receiver
  asks for longer with `Retry-After`.
