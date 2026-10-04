import { describe, expect, it } from 'vitest';
import { msUntilTokenRefresh } from './embedConfigQuery';

describe('msUntilTokenRefresh', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');

  it('renews five minutes before expiry', () => {
    expect(msUntilTokenRefresh('2026-01-01T11:00:00Z', now)).toBe(55 * 60_000);
  });

  it('never schedules faster than every 30 seconds', () => {
    expect(msUntilTokenRefresh('2026-01-01T10:01:00Z', now)).toBe(30_000);
    expect(msUntilTokenRefresh('2026-01-01T09:00:00Z', now)).toBe(30_000);
  });

  it('does not poll when the expiry is unknown', () => {
    expect(msUntilTokenRefresh(undefined, now)).toBe(false);
    expect(msUntilTokenRefresh('', now)).toBe(false);
    expect(msUntilTokenRefresh('not a date', now)).toBe(false);
  });
});
