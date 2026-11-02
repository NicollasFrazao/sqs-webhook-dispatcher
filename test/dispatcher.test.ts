import type { SQSRecord } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';

import { type QueuePort, createDispatcher } from '../src/dispatcher.js';

const job = {
  deliveryId: 'd-1',
  url: 'https://receiver.example/hooks',
  event: 'order.paid',
  payload: {},
};

function record(
  body: unknown,
  attempt = 1,
  id = 'm-1',
): SQSRecord {
  return {
    messageId: id,
    receiptHandle: `rh-${id}`,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    attributes: { ApproximateReceiveCount: String(attempt) },
  } as unknown as SQSRecord;
}

function setup(
  status: number | Error,
  overrides: Partial<QueuePort> = {},
) {
  // Mocks as plain properties, so asserting on them does not detach a method from its object.
  const mocks = {
    delay: vi.fn<QueuePort['delay']>().mockResolvedValue(undefined),
    deadLetter: vi.fn<QueuePort['deadLetter']>().mockResolvedValue(undefined),
  };

  const queue: QueuePort = {
    ...mocks,
    ...overrides,
  };

  const fetch = vi.fn<typeof globalThis.fetch>(() => status instanceof Error
    ? Promise.reject(status)
    : Promise.resolve(new Response(
        null,
        { status },
      )));

  const handler = createDispatcher({
    config: {
      maxAttempts: 3,
      backoff: {
        baseSeconds: 30,
        maxSeconds: 600,
      },
      requestTimeoutMs: 1000,
    },
    queue,
    fetch,
    signingSecret: () => Promise.resolve('secret'),
    random: () => 0.5,
    log: vi.fn(),
  });

  const run = (...records: SQSRecord[]) => handler({ Records: records });

  return {
    queue: mocks,
    fetch,
    run,
  };
}

describe('dispatcher', () => {
  it('acknowledges delivered messages', async () => {
    const {
      queue,
      run,
    } = setup(200);

    expect(await run(record(job))).toEqual({ batchItemFailures: [] });
    expect(queue.delay).not.toHaveBeenCalled();
    expect(queue.deadLetter).not.toHaveBeenCalled();
  });

  it('schedules a retry with backoff and reports the message as failed', async () => {
    const {
      queue,
      run,
    } = setup(503);

    expect(await run(record(
      job,
      2,
    ))).toEqual({ batchItemFailures: [{ itemIdentifier: 'm-1' }] });

    // attempt 2 → ceiling 60 s, random 0.5 → 30 s
    expect(queue.delay).toHaveBeenCalledWith(
      'rh-m-1',
      30,
    );
  });

  it('still retries when the delay cannot be set', async () => {
    const { run } = setup(
      503,
      { delay: vi.fn().mockRejectedValue(new Error('throttled')) },
    );

    expect(await run(record(job))).toEqual({ batchItemFailures: [{ itemIdentifier: 'm-1' }] });
  });

  it('dead-letters after the last attempt', async () => {
    const {
      queue,
      run,
    } = setup(new TypeError('fetch failed'));

    expect(await run(record(
      job,
      3,
    ))).toEqual({ batchItemFailures: [] });

    expect(queue.deadLetter).toHaveBeenCalledWith(
      JSON.stringify(job),
      expect.stringMatching(/gave up after 3 attempts/),
      3,
    );
  });

  it('dead-letters permanent failures without retrying', async () => {
    const {
      queue,
      run,
    } = setup(410);

    expect(await run(record(job))).toEqual({ batchItemFailures: [] });

    expect(queue.deadLetter).toHaveBeenCalledWith(
      JSON.stringify(job),
      'HTTP 410',
      1,
    );

    expect(queue.delay).not.toHaveBeenCalled();
  });

  it('dead-letters jobs that cannot be parsed, without calling the receiver', async () => {
    const {
      queue,
      fetch,
      run,
    } = setup(200);

    expect(await run(record('not json'))).toEqual({ batchItemFailures: [] });
    expect(fetch).not.toHaveBeenCalled();

    expect(queue.deadLetter).toHaveBeenCalledWith(
      'not json',
      expect.stringMatching(/^invalid job/),
      1,
    );
  });

  it('keeps the message when it cannot be dead-lettered', async () => {
    const { run } = setup(
      410,
      { deadLetter: vi.fn().mockRejectedValue(new Error('access denied')) },
    );

    expect(await run(record(job))).toEqual({ batchItemFailures: [{ itemIdentifier: 'm-1' }] });
  });

  it('handles each record of a batch on its own', async () => {
    const { run } = setup(200);
    const { run: runFailing } = setup(500);

    expect(await run(
      record(
        job,
        1,
        'a',
      ),
      record(
        job,
        1,
        'b',
      ),
    )).toEqual({ batchItemFailures: [] });

    expect((await runFailing(
      record(
        job,
        1,
        'a',
      ),
      record(
        job,
        1,
        'b',
      ),
    )).batchItemFailures).toHaveLength(2);
  });
});
