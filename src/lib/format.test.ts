import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatTaka } from './format';

describe('formatDate (Asia/Dhaka)', () => {
  it('formats a UTC ISO date', () => {
    expect(formatDate('2026-05-14T07:00:00Z')).toBe('14 May 2026');
  });
  it('rolls to the next Dhaka day for a late-UTC time (UTC+6)', () => {
    // 20:00Z → 02:00 the next day in Dhaka
    expect(formatDate('2026-05-14T20:00:00Z')).toBe('15 May 2026');
  });
  it('returns an em dash for null / invalid', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('formatTaka', () => {
  it('prefixes ৳ and groups thousands', () => {
    expect(formatTaka(1234.5)).toBe('৳1,234.5');
    expect(formatTaka(40)).toBe('৳40');
    expect(formatTaka(0)).toBe('৳0');
  });
  it('returns an em dash for null / NaN', () => {
    expect(formatTaka(null)).toBe('—');
    expect(formatTaka(undefined)).toBe('—');
    expect(formatTaka(Number.NaN)).toBe('—');
  });
});

describe('formatDateTime (Asia/Dhaka)', () => {
  it('includes the Dhaka date and time', () => {
    const out = formatDateTime('2026-05-14T07:00:00Z'); // 01:00 PM Dhaka
    expect(out).toContain('14 May 2026');
    expect(out).toMatch(/01:00/);
    expect(out.toLowerCase()).toContain('pm');
  });
  it('returns an em dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });
});
