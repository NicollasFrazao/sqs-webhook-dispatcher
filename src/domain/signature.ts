import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Request signing, so a receiver can check that a webhook came from us and was not replayed.
 *
 * The signed content is `${timestamp}.${body}`, and the header carries both parts:
 * `t=<unix seconds>,v1=<hex HMAC-SHA256>`. Including the timestamp in the signature lets the
 * receiver reject old requests without trusting a separate, unsigned header.
 */
export const SIGNATURE_HEADER = 'X-Webhook-Signature';

export function sign(secret: string, body: string, timestampSeconds: number): string {
  const digest = createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex');

  return `t=${timestampSeconds},v1=${digest}`;
}

export interface VerifyOptions {
  /** Oldest accepted signature, in seconds. Defaults to five minutes. */
  readonly toleranceSeconds?: number;
  /** Current time in unix seconds; injectable for tests. */
  readonly nowSeconds?: number;
}

/**
 * Receiver-side check, shipped with the dispatcher so both ends share one implementation.
 * Compares digests in constant time.
 */
export function verify(
  secret: string,
  body: string,
  header: string,
  { toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000) }: VerifyOptions = {},
): boolean {
  const parts = new Map(
    header.split(',').map((part) => {
      const [key = '', value = ''] = part.split('=', 2);
      return [key.trim(), value.trim()] as const;
    }),
  );

  const timestamp = Number(parts.get('t'));
  const received = parts.get('v1');

  if (!Number.isInteger(timestamp) || !received) {
    return false;
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = sign(secret, body, timestamp).split('v1=')[1] ?? '';
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');

  return a.length === b.length && timingSafeEqual(a, b);
}
