import { describe, expect, it } from 'vitest';

import { sign, verify } from '../src/domain/signature.js';

const secret = 'test-secret';
const body = '{"id":"d-1","event":"order.paid","data":{"total":42}}';
const now = 1_800_000_000;

describe('sign / verify', () => {
  it('accepts a signature it produced', () => {
    expect(verify(secret, body, sign(secret, body, now), { nowSeconds: now })).toBe(true);
  });

  it('puts the timestamp and the digest in the header', () => {
    expect(sign(secret, body, now)).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
  });

  it('rejects a tampered body', () => {
    const header = sign(secret, body, now);
    expect(verify(secret, body.replace('42', '4200'), header, { nowSeconds: now })).toBe(false);
  });

  it('rejects a different secret', () => {
    expect(verify('other-secret', body, sign(secret, body, now), { nowSeconds: now })).toBe(false);
  });

  it('rejects a replay older than the tolerance', () => {
    const header = sign(secret, body, now);
    expect(verify(secret, body, header, { nowSeconds: now + 301 })).toBe(false);
    expect(verify(secret, body, header, { nowSeconds: now + 299 })).toBe(true);
  });

  it('rejects malformed headers', () => {
    expect(verify(secret, body, 'garbage', { nowSeconds: now })).toBe(false);
    expect(verify(secret, body, `t=${now}`, { nowSeconds: now })).toBe(false);
    expect(verify(secret, body, `t=${now},v1=zz`, { nowSeconds: now })).toBe(false);
  });
});
