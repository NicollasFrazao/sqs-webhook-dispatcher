import { describe, expect, it } from 'vitest';

import { loadSettings } from '../src/adapters/config.js';

const required = {
  QUEUE_URL: 'https://sqs.example/queue',
  DEAD_LETTER_QUEUE_URL: 'https://sqs.example/dlq',
  SIGNING_SECRET_ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:signing',
};

describe('loadSettings', () => {
  it('reads the queue URLs and the secret, with the documented defaults', () => {
    expect(loadSettings(required)).toEqual({
      queueUrl: required.QUEUE_URL,
      deadLetterQueueUrl: required.DEAD_LETTER_QUEUE_URL,
      signingSecretArn: required.SIGNING_SECRET_ARN,
      dispatcher: {
        maxAttempts: 8,
        backoff: {
          baseSeconds: 30,
          maxSeconds: 3600,
        },
        requestTimeoutMs: 10000,
      },
    });
  });

  it('lets every tuning variable override its default', () => {
    const settings = loadSettings({
      ...required,
      MAX_ATTEMPTS: '5',
      BACKOFF_BASE_SECONDS: '10',
      BACKOFF_MAX_SECONDS: '600',
      REQUEST_TIMEOUT_MS: '2500',
    });

    expect(settings.dispatcher).toEqual({
      maxAttempts: 5,
      backoff: {
        baseSeconds: 10,
        maxSeconds: 600,
      },
      requestTimeoutMs: 2500,
    });
  });

  it.each(Object.keys(required))('fails the cold start without %s', (name) => {
    const environment: Record<string, string | undefined> = {
      ...required,
      [name]: undefined,
    };

    expect(() => loadSettings(environment)).toThrow(`missing environment variable ${name}`);
  });
});
