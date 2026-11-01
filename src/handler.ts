import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { ChangeMessageVisibilityCommand, SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

import { createDispatcher } from './dispatcher.js';

/** Lambda entry point: reads configuration from the environment and wires the AWS clients. */

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`missing environment variable ${name}`);
  }
  return value;
}

const sqs = new SQSClient({});
const secrets = new SecretsManagerClient({});

const queueUrl = env('QUEUE_URL');
const deadLetterQueueUrl = env('DEAD_LETTER_QUEUE_URL');
const secretArn = env('SIGNING_SECRET_ARN');

let cachedSecret: Promise<string> | undefined;

export const handler = createDispatcher({
  config: {
    maxAttempts: Number(env('MAX_ATTEMPTS', '8')),
    backoff: {
      baseSeconds: Number(env('BACKOFF_BASE_SECONDS', '30')),
      maxSeconds: Number(env('BACKOFF_MAX_SECONDS', '3600')),
    },
    requestTimeoutMs: Number(env('REQUEST_TIMEOUT_MS', '10000')),
  },
  fetch: globalThis.fetch,
  // Fetched once per container; a failed fetch is not cached, so the next invocation retries.
  signingSecret: () => {
    cachedSecret ??= secrets
      .send(new GetSecretValueCommand({ SecretId: secretArn }))
      .then(({ SecretString }) => {
        if (!SecretString) throw new Error('signing secret is empty');
        return SecretString;
      })
      .catch((error: unknown) => {
        cachedSecret = undefined;
        throw error;
      });
    return cachedSecret;
  },
  queue: {
    async delay(receiptHandle, seconds) {
      await sqs.send(
        new ChangeMessageVisibilityCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle, VisibilityTimeout: seconds }),
      );
    },
    async deadLetter(body, reason, attempt) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: deadLetterQueueUrl,
          MessageBody: body,
          MessageAttributes: {
            reason: { DataType: 'String', StringValue: reason.slice(0, 1024) },
            attempts: { DataType: 'Number', StringValue: String(attempt) },
          },
        }),
      );
    },
  },
});
