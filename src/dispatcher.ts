import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';

import { type BackoffPolicy, retryDelaySeconds } from './domain/backoff.js';
import { type DeliverDeps, type WebhookJob, deliver, parseJob } from './domain/delivery.js';

/** Retry budget and timing of the dispatcher, read from the function's environment. */
export interface DispatcherConfig {
  /** Attempts before a delivery is given up and moved to the dead-letter queue. */
  readonly maxAttempts: number;
  /** Spacing of the retries, see {@link retryDelaySeconds}. */
  readonly backoff: BackoffPolicy;
  /** Timeout of each request to the receiver, in milliseconds. */
  readonly requestTimeoutMs: number;
}

/** The queue operations the dispatcher needs, kept narrow so tests can fake them. */
export interface QueuePort {
  /** Holds a message back: it becomes visible again (and is retried) after `seconds`. */
  delay(receiptHandle: string, seconds: number): Promise<void>;
  /** Parks a message for inspection, with the reason it was given up. */
  deadLetter(body: string, reason: string, attempt: number): Promise<void>;
}

/**
 * Everything the dispatcher talks to, injected so tests run without AWS or a network.
 *
 * @remarks
 * The optional members default to the real clock, `Math.random` and JSON lines on stdout
 * (which Lambda ships to CloudWatch Logs).
 */
export interface DispatcherDeps {
  readonly config: DispatcherConfig;
  readonly queue: QueuePort;
  /** Called once per batch; the caller decides how to cache it. */
  readonly signingSecret: () => Promise<string>;
  readonly fetch: typeof globalThis.fetch;
  /** Current time in unix seconds. */
  readonly nowSeconds?: () => number;
  /** Source of randomness in [0, 1) for the backoff jitter. */
  readonly random?: () => number;
  /** Receives one structured entry per outcome. */
  readonly log?: (entry: Record<string, unknown>) => void;
}

const MILLISECONDS_PER_SECOND = 1000;

const defaultLog = (entry: Record<string, unknown>): void => {
  console.log(JSON.stringify(entry));
};

/**
 * Builds the Lambda handler for an SQS event source with `reportBatchItemFailures` enabled.
 *
 * Each record is one delivery attempt. A record reported as failed is left on the queue and
 * comes back when its visibility timeout ends; the dispatcher sets that timeout to the backoff
 * delay first, which is how retries get spaced out without a scheduler. Everything else is
 * removed from the queue: delivered, or moved to the dead-letter queue with a reason.
 */
export function createDispatcher(deps: DispatcherDeps): (event: SQSEvent) => Promise<SQSBatchResponse> {
  const nowSeconds = deps.nowSeconds ?? (() => Math.floor(Date.now() / MILLISECONDS_PER_SECOND));
  const random = deps.random ?? Math.random;
  const log = deps.log ?? defaultLog;

  return async (event) => {
    const secret = await deps.signingSecret();

    const deliverDeps: DeliverDeps = {
      fetch: deps.fetch,
      signingSecret: secret,
      timeoutMs: deps.config.requestTimeoutMs,
      nowSeconds,
    };

    const failures = await Promise.all(event.Records.map((record) => processRecord(record)));

    return { batchItemFailures: failures.filter((failure): failure is SQSBatchItemFailure => failure !== null) };

    async function processRecord(record: SQSRecord): Promise<SQSBatchItemFailure | null> {
      const attempt = Number(record.attributes.ApproximateReceiveCount) || 1;
      const retryLater: SQSBatchItemFailure = { itemIdentifier: record.messageId };

      let job: WebhookJob;

      try {
        job = parseJob(record.body);
      } catch (error) {
        return giveUp(`invalid job: ${(error as Error).message}`);
      }

      const outcome = await deliver(
        job,
        attempt,
        deliverDeps,
      );

      const context = {
        deliveryId: job.deliveryId,
        event: job.event,
        attempt,
      };

      switch (outcome.kind) {
        case 'delivered':
          log({
            level: 'info',
            msg: 'delivered',
            ...context,
            status: outcome.status,
          });

          return null;

        case 'rejected':
          return giveUp(
            outcome.reason,
            context,
          );

        case 'retry': {
          if (attempt >= deps.config.maxAttempts) {
            return giveUp(
              `gave up after ${attempt} attempts, last: ${outcome.reason}`,
              context,
            );
          }

          const delay = outcome.retryAfterSeconds ?? retryDelaySeconds(
            attempt,
            deps.config.backoff,
            random,
          );

          try {
            await deps.queue.delay(
              record.receiptHandle,
              delay,
            );
          } catch (error) {
            // The message still comes back, only after the queue's default visibility timeout.
            log({
              level: 'warn',
              msg: 'could not set retry delay',
              ...context,
              error: String(error),
            });
          }

          log({
            level: 'warn',
            msg: 'retry scheduled',
            ...context,
            reason: outcome.reason,
            delaySeconds: delay,
          });

          return retryLater;
        }
      }

      async function giveUp(
        reason: string,
        extra: Record<string, unknown> = {},
      ): Promise<SQSBatchItemFailure | null> {
        try {
          await deps.queue.deadLetter(
            record.body,
            reason,
            attempt,
          );
        } catch (error) {
          // Never drop a message we could not park: leave it on the queue and try again.
          log({
            level: 'error',
            msg: 'dead-letter failed',
            messageId: record.messageId,
            error: String(error),
          });

          return retryLater;
        }

        log({
          level: 'error',
          msg: 'dead-lettered',
          messageId: record.messageId,
          reason,
          ...extra,
        });

        return null;
      }
    }
  };
}
