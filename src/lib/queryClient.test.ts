import { describe, it, expect, vi } from 'vitest';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

import { queryClient } from './queryClient';
import { ApiError } from './errors';

const retry = queryClient.getDefaultOptions().queries!.retry as (failureCount: number, error: unknown) => boolean;

describe('queryClient retry policy', () => {
  it('never retries 4xx', () => {
    expect(retry(0, new ApiError(404, { status: 404, title: 'x' }))).toBe(false);
    expect(retry(0, new ApiError(400, { status: 400, title: 'x' }))).toBe(false);
    expect(retry(0, new ApiError(409, { status: 409, title: 'x' }))).toBe(false);
  });
  it('retries 5xx / network errors, up to 2 attempts', () => {
    expect(retry(0, new ApiError(500, { status: 500, title: 'x' }))).toBe(true);
    expect(retry(1, new Error('network'))).toBe(true);
    expect(retry(2, new Error('network'))).toBe(false);
  });
});
