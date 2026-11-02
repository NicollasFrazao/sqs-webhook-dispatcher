import { describe, expect, it } from 'vitest';

import { SQS_MAX_VISIBILITY_SECONDS, retryDelaySeconds } from '../src/domain/backoff.js';

const policy = {
  baseSeconds: 30,
  maxSeconds: 3600,
};

const highest = () => 0.999_999;

describe('retryDelaySeconds', () => {
  it('doubles the ceiling with every attempt', () => {
    expect(retryDelaySeconds(
      1,
      policy,
      highest,
    )).toBe(30);

    expect(retryDelaySeconds(
      2,
      policy,
      highest,
    )).toBe(60);

    expect(retryDelaySeconds(
      3,
      policy,
      highest,
    )).toBe(120);
  });

  it('never goes above maxSeconds', () => {
    expect(retryDelaySeconds(
      20,
      policy,
      highest,
    )).toBe(3600);
  });

  it('spreads retries between zero and the ceiling (full jitter)', () => {
    expect(retryDelaySeconds(
      3,
      policy,
      () => 0,
    )).toBe(0);

    expect(retryDelaySeconds(
      3,
      policy,
      () => 0.5,
    )).toBe(60);
  });

  it('stays within the SQS visibility timeout limit', () => {
    const huge = {
      baseSeconds: 3600,
      maxSeconds: 10 * SQS_MAX_VISIBILITY_SECONDS,
    };

    expect(retryDelaySeconds(
      10,
      huge,
      highest,
    )).toBe(SQS_MAX_VISIBILITY_SECONDS);
  });

  it('rejects attempts that are not positive integers', () => {
    expect(() => retryDelaySeconds(
      0,
      policy,
    )).toThrow(RangeError);

    expect(() => retryDelaySeconds(
      1.5,
      policy,
    )).toThrow(RangeError);
  });
});
