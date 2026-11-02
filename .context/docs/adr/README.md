# Architecture decision records

One file per decision that shaped the code and would be expensive to reverse. Each says what was
decided, what else was considered, and what it costs. A superseded record stays, marked as such.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-retry-with-visibility-timeout.md) | Space retries with the message's visibility timeout and partial batch failures | Accepted |
| [0002](0002-dead-letter-from-code.md) | The function dead-letters with a reason; the redrive policy is only a safety net | Accepted |
| [0003](0003-full-jitter-backoff.md) | Exponential backoff with full jitter; `Retry-After` in seconds wins | Accepted |
