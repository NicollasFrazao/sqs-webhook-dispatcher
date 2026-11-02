import { SIGNATURE_HEADER, sign } from './signature.js';

/** One webhook to deliver: the message body on the queue. */
export interface WebhookJob {
  /** Stable across retries, so the receiver can deduplicate. */
  readonly deliveryId: string;
  /** The receiver; `https` only. */
  readonly url: string;
  /** Event name, sent in `X-Webhook-Event` (for example `order.paid`). */
  readonly event: string;
  /** Any JSON value; sent as `data` in the request body. */
  readonly payload: unknown;
}

/**
 * What happened to one attempt.
 *
 * - `delivered`: the receiver answered 2xx.
 * - `retry`: worth trying again later (network error, timeout, 5xx, 408, 429).
 * - `rejected`: retrying will not help (any other 4xx, or a job that cannot be parsed).
 */
export type DeliveryOutcome =
  | {
    readonly kind: 'delivered';
    readonly status: number;
  }
  | {
    readonly kind: 'retry';
    readonly reason: string;
    readonly retryAfterSeconds?: number;
  }
  | {
    readonly kind: 'rejected';
    readonly reason: string;
  };

/** What one delivery attempt needs besides the job itself. */
export interface DeliverDeps {
  readonly fetch: typeof globalThis.fetch;
  /** HMAC key for the `X-Webhook-Signature` header. */
  readonly signingSecret: string;
  /** Timeout of the request, in milliseconds. */
  readonly timeoutMs: number;
  /** Current time in unix seconds, signed into the request. */
  readonly nowSeconds: () => number;
}

const HTTP_OK_MIN = 200;
const HTTP_OK_END = 300;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_EARLY = 425;
const HTTP_TOO_MANY_REQUESTS = 429;

/** The 4xx statuses that say "try again later" rather than "this request is wrong". */
const RETRYABLE_4XX = new Set([
  HTTP_REQUEST_TIMEOUT,
  HTTP_TOO_EARLY,
  HTTP_TOO_MANY_REQUESTS,
]);

/** Whether a parsed message body has the fields of a {@link WebhookJob}, before the URL check. */
function hasJobFields(value: unknown): value is WebhookJob {
  if (
    typeof value !== 'object'
    || value === null
    || !('payload' in value)
  ) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.deliveryId === 'string'
    && typeof candidate.url === 'string'
    && typeof candidate.event === 'string'
  );
}

/**
 * Parses and validates a message body taken from the delivery queue.
 *
 * @throws {@link SyntaxError} when the body is not JSON.
 * @throws {@link TypeError} when a field is missing or the URL is invalid or not `https`.
 */
export function parseJob(raw: string): WebhookJob {
  const job: unknown = JSON.parse(raw);

  if (!hasJobFields(job)) {
    throw new TypeError('job must have deliveryId, url, event and payload');
  }

  const url = new URL(job.url);

  if (url.protocol !== 'https:') {
    throw new TypeError(`webhook URLs must use https, got ${url.protocol}`);
  }

  return job;
}

/**
 * Makes one signed POST to the receiver and classifies the answer.
 *
 * @remarks
 * Never throws: a network error or a timeout is a `retry` outcome. Redirects are not followed,
 * so a `3xx` is `rejected` rather than a request to a URL nobody registered.
 * The `attempt` number (1 for the first try) is sent in `X-Webhook-Attempt`.
 */
export async function deliver(
  job: WebhookJob,
  attempt: number,
  deps: DeliverDeps,
): Promise<DeliveryOutcome> {
  const body = JSON.stringify({
    id: job.deliveryId,
    event: job.event,
    data: job.payload,
  });

  const timestamp = deps.nowSeconds();

  let response: Response;

  try {
    response = await deps.fetch(
      job.url,
      {
        method: 'POST',
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(deps.timeoutMs),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'sqs-webhook-dispatcher',
          'X-Webhook-Id': job.deliveryId,
          'X-Webhook-Event': job.event,
          'X-Webhook-Attempt': String(attempt),
          [SIGNATURE_HEADER]: sign(
            deps.signingSecret,
            body,
            timestamp,
          ),
        },
      },
    );
  } catch (error) {
    // Timeouts, DNS failures and refused connections all land here, and all are transient.
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

    return {
      kind: 'retry',
      reason,
    };
  }

  if (
    response.status >= HTTP_OK_MIN
    && response.status < HTTP_OK_END
  ) {
    return {
      kind: 'delivered',
      status: response.status,
    };
  }

  if (
    response.status >= HTTP_SERVER_ERROR_MIN
    || RETRYABLE_4XX.has(response.status)
  ) {
    const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));

    return retryAfterSeconds === undefined
      ? {
          kind: 'retry',
          reason: `HTTP ${response.status}`,
        }
      : {
          kind: 'retry',
          reason: `HTTP ${response.status}`,
          retryAfterSeconds,
        };
  }

  return {
    kind: 'rejected',
    reason: `HTTP ${response.status}`,
  };
}

/** Only the delay-seconds form of Retry-After; an HTTP date falls back to the backoff policy. */
function parseRetryAfter(value: string | null): number | undefined {
  if (
    value === null
    || !/^\d+$/.test(value.trim())
  ) {
    return undefined;
  }

  return Number(value.trim());
}
