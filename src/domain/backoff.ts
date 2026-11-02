/** How far apart the retries of a failed delivery are spaced. */
export interface BackoffPolicy {
  /** Ceiling for the first retry, in seconds. */
  readonly baseSeconds: number;
  /** Upper bound for any single delay, in seconds. */
  readonly maxSeconds: number;
}

/** SQS's limit for a message's visibility timeout (12 hours), the longest a retry can be held back. */
export const SQS_MAX_VISIBILITY_SECONDS = 43_200;

/**
 * Retry delay for a failed delivery, using exponential backoff with "full jitter".
 *
 * @remarks
 * The ceiling doubles with every attempt (base, 2·base, 4·base…) up to `maxSeconds`, and the
 * actual delay is a random value between 0 and that ceiling. Full jitter spreads retries out,
 * so a receiver that comes back after an outage is not hit by every queued delivery at once.
 *
 * The result is clamped to {@link SQS_MAX_VISIBILITY_SECONDS}, because the visibility timeout is
 * the mechanism used to hold a message back until its next attempt.
 *
 * @param attempt - The attempt that just failed, starting at 1.
 * @param policy - Base and maximum ceiling, in seconds.
 * @param random - Source of randomness in [0, 1); injectable so tests are deterministic.
 *
 * @returns Whole seconds to wait before the next attempt.
 *
 * @throws {@link RangeError} when `attempt` is not a positive integer.
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
export function retryDelaySeconds(
  attempt: number,
  policy: BackoffPolicy,
  random: () => number = Math.random,
): number {
  if (
    !Number.isInteger(attempt)
    || attempt < 1
  ) {
    throw new RangeError(`attempt must be a positive integer, got ${attempt}`);
  }

  const ceiling = Math.min(
    policy.maxSeconds,
    policy.baseSeconds * 2 ** (attempt - 1),
  );

  const delay = Math.floor(random() * (ceiling + 1));

  return Math.min(
    delay,
    SQS_MAX_VISIBILITY_SECONDS,
  );
}
