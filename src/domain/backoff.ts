/**
 * Retry delay for a failed delivery, using exponential backoff with "full jitter".
 *
 * The ceiling doubles with every attempt (base, 2·base, 4·base…) up to `maxSeconds`, and the
 * actual delay is a random value between 0 and that ceiling. Full jitter spreads retries out,
 * so a receiver that comes back after an outage is not hit by every queued delivery at once.
 * See https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/.
 *
 * The result is clamped to SQS's limit for a message's visibility timeout (12 hours), because
 * that is the mechanism used to hold a message back until its next attempt.
 */
export interface BackoffPolicy {
  /** Ceiling for the first retry, in seconds. */
  readonly baseSeconds: number;
  /** Upper bound for any single delay, in seconds. */
  readonly maxSeconds: number;
}

export const SQS_MAX_VISIBILITY_SECONDS = 12 * 60 * 60;

/**
 * @param attempt - The attempt that just failed, starting at 1.
 * @param random - Source of randomness in [0, 1); injectable so tests are deterministic.
 */
export function retryDelaySeconds(
  attempt: number,
  policy: BackoffPolicy,
  random: () => number = Math.random,
): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError(`attempt must be a positive integer, got ${attempt}`);
  }

  const ceiling = Math.min(policy.maxSeconds, policy.baseSeconds * 2 ** (attempt - 1));
  const delay = Math.floor(random() * (ceiling + 1));

  return Math.min(delay, SQS_MAX_VISIBILITY_SECONDS);
}
