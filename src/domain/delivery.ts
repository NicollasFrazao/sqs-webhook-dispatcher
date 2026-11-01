import { SIGNATURE_HEADER, sign } from './signature.js';

/** One webhook to deliver: the message body on the queue. */
export interface WebhookJob {
  /** Stable across retries, so the receiver can deduplicate. */
  readonly deliveryId: string;
  readonly url: string;
  readonly event: string;
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
  | { readonly kind: 'delivered'; readonly status: number }
  | { readonly kind: 'retry'; readonly reason: string; readonly retryAfterSeconds?: number }
  | { readonly kind: 'rejected'; readonly reason: string };

export interface DeliverDeps {
  readonly fetch: typeof globalThis.fetch;
  readonly signingSecret: string;
  readonly timeoutMs: number;
  readonly nowSeconds: () => number;
}

const RETRYABLE_4XX = new Set([408, 425, 429]);

export function parseJob(raw: string): WebhookJob {
  const job: unknown = JSON.parse(raw);

  if (
    typeof job !== 'object' ||
    job === null ||
    typeof (job as WebhookJob).deliveryId !== 'string' ||
    typeof (job as WebhookJob).url !== 'string' ||
    typeof (job as WebhookJob).event !== 'string' ||
    !('payload' in job)
  ) {
    throw new TypeError('job must have deliveryId, url, event and payload');
  }

  const url = new URL((job as WebhookJob).url);
  if (url.protocol !== 'https:') {
    throw new TypeError(`webhook URLs must use https, got ${url.protocol}`);
  }

  return job as WebhookJob;
}

export async function deliver(job: WebhookJob, attempt: number, deps: DeliverDeps): Promise<DeliveryOutcome> {
  const body = JSON.stringify({ id: job.deliveryId, event: job.event, data: job.payload });
  const timestamp = deps.nowSeconds();

  let response: Response;
  try {
    response = await deps.fetch(job.url, {
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
        [SIGNATURE_HEADER]: sign(deps.signingSecret, body, timestamp),
      },
    });
  } catch (error) {
    // Timeouts, DNS failures and refused connections all land here, and all are transient.
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { kind: 'retry', reason };
  }

  if (response.status >= 200 && response.status < 300) {
    return { kind: 'delivered', status: response.status };
  }

  if (response.status >= 500 || RETRYABLE_4XX.has(response.status)) {
    const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
    return retryAfterSeconds === undefined
      ? { kind: 'retry', reason: `HTTP ${response.status}` }
      : { kind: 'retry', reason: `HTTP ${response.status}`, retryAfterSeconds };
  }

  return { kind: 'rejected', reason: `HTTP ${response.status}` };
}

/** Only the delay-seconds form of Retry-After; an HTTP date falls back to the backoff policy. */
function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value.trim())) {
    return undefined;
  }
  return Number(value.trim());
}
