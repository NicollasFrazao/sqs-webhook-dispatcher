import { GetSecretValueCommand, type SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { ChangeMessageVisibilityCommand, SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';

import type { QueuePort } from '../dispatcher.js';

/** SQS message attributes hold at most this much of the reason; the rest is in the logs. */
const MAX_REASON_LENGTH = 1024;

/** The queue URLs {@link createSqsQueue} needs. */
export interface QueueUrls {
  readonly queueUrl: string;
  readonly deadLetterQueueUrl: string;
}

/**
 * The {@link QueuePort} on top of SQS.
 *
 * @remarks
 * A retry is delayed with `ChangeMessageVisibility` on the delivery queue; a given-up delivery is
 * sent to the dead-letter queue with its reason and attempt count as message attributes.
 */
export function createSqsQueue(
  sqs: Pick<SQSClient, 'send'>,
  urls: QueueUrls,
): QueuePort {
  return {
    async delay(
      receiptHandle,
      seconds,
    ) {
      await sqs.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: urls.queueUrl,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: seconds,
        }),
      );
    },
    async deadLetter(
      body,
      reason,
      attempt,
    ) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: urls.deadLetterQueueUrl,
          MessageBody: body,
          MessageAttributes: {
            reason: {
              DataType: 'String',
              StringValue: reason.slice(
                0,
                MAX_REASON_LENGTH,
              ),
            },
            attempts: {
              DataType: 'Number',
              StringValue: String(attempt),
            },
          },
        }),
      );
    },
  };
}

/**
 * Reads the signing key from Secrets Manager once per container.
 *
 * @remarks
 * A failed read is not cached, so the next invocation tries again instead of failing until the
 * container is recycled.
 *
 * @returns A function that resolves to the key, and rejects when the secret is empty or unreadable.
 */
export function cachedSigningSecret(
  secrets: Pick<SecretsManagerClient, 'send'>,
  secretArn: string,
): () => Promise<string> {
  let cached: Promise<string> | undefined;

  return () => {
    cached ??= secrets
      .send(new GetSecretValueCommand({ SecretId: secretArn }))
      .then(({ SecretString }) => {
        if (!SecretString) {
          throw new Error('signing secret is empty');
        }

        return SecretString;
      })
      .catch((error: unknown) => {
        cached = undefined;

        throw error;
      });

    return cached;
  };
}
