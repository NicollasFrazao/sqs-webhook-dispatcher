import { createHmac, timingSafeEqual } from 'node:crypto';

// Request signing, so a receiver can check that a webhook came from us and was not replayed.
//
// The signed content is `${timestamp}.${body}`, and the header carries both parts:
// `t=<unix seconds>,v1=<hex HMAC-SHA256>`. Including the timestamp in the signature lets the
// receiver reject old requests without trusting a separate, unsigned header.

/** Name of the request header that carries the timestamp and the signature. */
export const SIGNATURE_HEADER = 'X-Webhook-Signature';

const MILLISECONDS_PER_SECOND = 1000;
const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Signs a request body, with the time it is sent, for the `X-Webhook-Signature` header.
 *
 * @param secret - The HMAC key.
 * @param body - The exact bytes that will be sent.
 * @param timestampSeconds - Unix seconds, signed together with the body.
 *
 * @returns The header value, `t=<timestamp>,v1=<hex HMAC-SHA256>`.
 */
export function sign(
  secret: string,
  body: string,
  timestampSeconds: number,
): string {
  const digest = createHmac(
    'sha256',
    secret,
  ).update(`${timestampSeconds}.${body}`).digest('hex');

  return `t=${timestampSeconds},v1=${digest}`;
}

/** Tuning of {@link verify}. */
export interface VerifyOptions {
  /** Oldest accepted signature, in seconds. Defaults to five minutes. */
  readonly toleranceSeconds?: number;
  /** Current time in unix seconds; injectable for tests. */
  readonly nowSeconds?: number;
}

/** Splits `t=...,v1=...` into its named parts; malformed parts become empty strings. */
function parseHeader(header: string): Map<string, string> {
  return new Map(
    header.split(',').map((part) => {
      const [
        key = '',
        value = '',
      ] = part.split(
        '=',
        2,
      );

      return [
        key.trim(),
        value.trim(),
      ] as const;
    }),
  );
}

/**
 * Receiver-side check of a signature header, shipped with the dispatcher so both ends share one
 * implementation.
 *
 * @remarks
 * Digests are compared in constant time, so the comparison does not leak how many leading
 * characters matched.
 *
 * @param secret - The HMAC key shared with the dispatcher.
 * @param body - The raw request body, before any JSON parsing.
 * @param header - The value of `X-Webhook-Signature` as received.
 * @param options - Tolerance and clock, see {@link VerifyOptions}.
 * @param options.toleranceSeconds - Oldest accepted signature; five minutes by default.
 * @param options.nowSeconds - Current time in unix seconds; the system clock by default.
 *
 * @returns `false` for a malformed header, a timestamp outside the tolerance or a wrong digest.
 */
export function verify(
  secret: string,
  body: string,
  header: string,
  {
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
    nowSeconds = Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
  }: VerifyOptions = {},
): boolean {
  const parts = parseHeader(header);
  const timestamp = Number(parts.get('t'));
  const received = parts.get('v1');

  if (
    !Number.isInteger(timestamp)
    || !received
  ) {
    return false;
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = sign(
    secret,
    body,
    timestamp,
  ).split('v1=')[1] ?? '';

  const expectedDigest = Buffer.from(
    expected,
    'hex',
  );

  const receivedDigest = Buffer.from(
    received,
    'hex',
  );

  return (
    expectedDigest.length === receivedDigest.length
    && timingSafeEqual(
      expectedDigest,
      receivedDigest,
    )
  );
}
