import { describe, expect, it, vi } from 'vitest';

import { type WebhookJob, deliver, parseJob } from '../src/domain/delivery.js';
import { verify } from '../src/domain/signature.js';

const job: WebhookJob = {
  deliveryId: 'd-1',
  url: 'https://receiver.example/hooks',
  event: 'order.paid',
  payload: { total: 42 },
};

const respond = (
  status: number,
  headers: Record<string, string> = {},
) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(
    null,
    {
      status,
      headers,
    },
  ));

const deps = (fetch: typeof globalThis.fetch) => ({
  fetch,
  signingSecret: 's3cret',
  timeoutMs: 1000,
  nowSeconds: () => 1_800_000_000,
});

describe('parseJob', () => {
  it('accepts a complete job', () => {
    expect(parseJob(JSON.stringify(job))).toEqual(job);
  });

  it('rejects missing fields', () => {
    expect(() => parseJob(JSON.stringify({ url: job.url }))).toThrow(TypeError);
  });

  it('rejects plain http URLs', () => {
    expect(() => parseJob(JSON.stringify({
      ...job,
      url: 'http://receiver.example',
    }))).toThrow(/https/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseJob('{')).toThrow(SyntaxError);
  });
});

describe('deliver', () => {
  it('reports 2xx as delivered', async () => {
    expect(await deliver(
      job,
      1,
      deps(respond(204)),
    )).toEqual({
      kind: 'delivered',
      status: 204,
    });
  });

  it('retries 5xx, 408 and 429', async () => {
    for (const status of [
      500,
      503,
      408,
      429,
    ]) {
      expect((await deliver(
        job,
        1,
        deps(respond(status)),
      )).kind).toBe('retry');
    }
  });

  it('honours a Retry-After in seconds', async () => {
    const outcome = await deliver(
      job,
      1,
      deps(respond(
        429,
        { 'Retry-After': '120' },
      )),
    );

    expect(outcome).toEqual({
      kind: 'retry',
      reason: 'HTTP 429',
      retryAfterSeconds: 120,
    });
  });

  it('does not retry other 4xx', async () => {
    expect(await deliver(
      job,
      1,
      deps(respond(404)),
    )).toEqual({
      kind: 'rejected',
      reason: 'HTTP 404',
    });
  });

  it('treats a 3xx as rejected instead of following it', async () => {
    expect((await deliver(
      job,
      1,
      deps(respond(301)),
    )).kind).toBe('rejected');
  });

  it('retries network errors and timeouts', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new DOMException(
      'timed out',
      'TimeoutError',
    ));

    expect(await deliver(
      job,
      1,
      deps(fetch),
    )).toEqual({
      kind: 'retry',
      reason: 'TimeoutError: timed out',
    });
  });

  it('sends a signed request the receiver can verify', async () => {
    const fetch = respond(200);

    await deliver(
      job,
      3,
      deps(fetch),
    );

    const [
      url,
      init,
    ] = fetch.mock.calls.at(0) ?? [];

    const headers = init?.headers as Record<string, string>;

    expect(url).toBe(job.url);
    expect(headers['X-Webhook-Id']).toBe('d-1');
    expect(headers['X-Webhook-Attempt']).toBe('3');

    expect(verify(
      's3cret',
      init?.body as string,
      headers['X-Webhook-Signature'] ?? '',
      { nowSeconds: 1_800_000_000 },
    )).toBe(true);
  });
});
