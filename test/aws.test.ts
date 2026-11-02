import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ChangeMessageVisibilityCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { describe, expect, it, vi } from 'vitest';

import { cachedSigningSecret, createSqsQueue } from '../src/adapters/aws.js';

const urls = {
  queueUrl: 'https://sqs.example/queue',
  deadLetterQueueUrl: 'https://sqs.example/dlq',
};

/** A client whose `send` records the command and resolves to `output`. */
function fakeClient(output: unknown = {}) {
  const send = vi.fn<(command: unknown) => Promise<unknown>>().mockResolvedValue(output);

  return {
    send,
    client: { send } as never,
  };
}

describe('createSqsQueue', () => {
  it('delays a retry by changing the visibility of the message on the delivery queue', async () => {
    const {
      send,
      client,
    } = fakeClient();

    await createSqsQueue(
      client,
      urls,
    ).delay(
      'rh-1',
      45,
    );

    const command = send.mock.calls.at(0)?.at(0);

    expect(command).toBeInstanceOf(ChangeMessageVisibilityCommand);

    expect((command as ChangeMessageVisibilityCommand).input).toEqual({
      QueueUrl: urls.queueUrl,
      ReceiptHandle: 'rh-1',
      VisibilityTimeout: 45,
    });
  });

  it('dead-letters the original body with the reason and the attempt count', async () => {
    const {
      send,
      client,
    } = fakeClient();

    await createSqsQueue(
      client,
      urls,
    ).deadLetter(
      '{"a":1}',
      'HTTP 410',
      3,
    );

    const command = send.mock.calls.at(0)?.at(0);

    expect(command).toBeInstanceOf(SendMessageCommand);

    expect((command as SendMessageCommand).input).toEqual({
      QueueUrl: urls.deadLetterQueueUrl,
      MessageBody: '{"a":1}',
      MessageAttributes: {
        reason: {
          DataType: 'String',
          StringValue: 'HTTP 410',
        },
        attempts: {
          DataType: 'Number',
          StringValue: '3',
        },
      },
    });
  });

  it('truncates the reason to what a message attribute can hold', async () => {
    const {
      send,
      client,
    } = fakeClient();

    await createSqsQueue(
      client,
      urls,
    ).deadLetter(
      '{}',
      'x'.repeat(5000),
      1,
    );

    const input = (send.mock.calls.at(0)?.at(0) as SendMessageCommand).input;

    expect(input.MessageAttributes?.reason?.StringValue).toHaveLength(1024);
  });
});

describe('cachedSigningSecret', () => {
  it('reads the secret once and reuses it', async () => {
    const {
      send,
      client,
    } = fakeClient({ SecretString: 'k3y' });

    const secret = cachedSigningSecret(
      client,
      'arn:secret',
    );

    expect(await secret()).toBe('k3y');
    expect(await secret()).toBe('k3y');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls.at(0)?.at(0)).toBeInstanceOf(GetSecretValueCommand);
  });

  it('rejects an empty secret and does not cache the failure', async () => {
    const {
      send,
      client,
    } = fakeClient({});

    const secret = cachedSigningSecret(
      client,
      'arn:secret',
    );

    await expect(secret()).rejects.toThrow('signing secret is empty');
    await expect(secret()).rejects.toThrow('signing secret is empty');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('retries after a failed read', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('throttled'))
      .mockResolvedValueOnce({ SecretString: 'k3y' });

    const secret = cachedSigningSecret(
      { send } as never,
      'arn:secret',
    );

    await expect(secret()).rejects.toThrow('throttled');
    expect(await secret()).toBe('k3y');
  });
});
