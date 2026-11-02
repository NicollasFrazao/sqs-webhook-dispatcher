import type { DispatcherConfig } from '../dispatcher.js';

/** Everything the Lambda reads from its environment, already parsed. */
export interface Settings {
  readonly dispatcher: DispatcherConfig;
  /** The delivery queue, where retries are delayed. */
  readonly queueUrl: string;
  /** Where given-up deliveries are parked. */
  readonly deadLetterQueueUrl: string;
  /** Secrets Manager secret holding the HMAC key. */
  readonly signingSecretArn: string;
}

const DEFAULT_MAX_ATTEMPTS = '8';
const DEFAULT_BACKOFF_BASE_SECONDS = '30';
const DEFAULT_BACKOFF_MAX_SECONDS = '3600';
const DEFAULT_REQUEST_TIMEOUT_MS = '10000';

/**
 * Reads the settings from an environment such as `process.env`.
 *
 * @remarks
 * The variables without a default are set by the CDK stack; their absence means the function was
 * deployed by hand, which is worth failing the cold start for.
 *
 * @throws {@link Error} when `QUEUE_URL`, `DEAD_LETTER_QUEUE_URL` or `SIGNING_SECRET_ARN` is missing.
 */
export function loadSettings(environment: NodeJS.ProcessEnv): Settings {
  /**
   * One variable, or its fallback.
   *
   * @throws {@link Error} when neither is set.
   */
  function read(
    name: string,
    fallback?: string,
  ): string {
    const value = environment[name] ?? fallback;

    if (value === undefined) {
      throw new Error(`missing environment variable ${name}`);
    }

    return value;
  }

  const queueUrl = read('QUEUE_URL');
  const deadLetterQueueUrl = read('DEAD_LETTER_QUEUE_URL');
  const signingSecretArn = read('SIGNING_SECRET_ARN');

  return {
    queueUrl,
    deadLetterQueueUrl,
    signingSecretArn,
    dispatcher: {
      maxAttempts: Number(read(
        'MAX_ATTEMPTS',
        DEFAULT_MAX_ATTEMPTS,
      )),
      backoff: {
        baseSeconds: Number(read(
          'BACKOFF_BASE_SECONDS',
          DEFAULT_BACKOFF_BASE_SECONDS,
        )),
        maxSeconds: Number(read(
          'BACKOFF_MAX_SECONDS',
          DEFAULT_BACKOFF_MAX_SECONDS,
        )),
      },
      requestTimeoutMs: Number(read(
        'REQUEST_TIMEOUT_MS',
        DEFAULT_REQUEST_TIMEOUT_MS,
      )),
    },
  };
}
