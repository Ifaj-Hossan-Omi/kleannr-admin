import { describe, it, expect, vi } from 'vitest';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

import { ApiError, messageForError, notifyError, notifySuccess } from './errors';
import { notifications } from '@mantine/notifications';

describe('ApiError', () => {
  it('captures status / code / detail / title', () => {
    const e = new ApiError(409, { status: 409, title: 'conflict', detail: 'rider_has_active_jobs' });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(409);
    expect(e.title).toBe('conflict');
    expect(e.detail).toBe('rider_has_active_jobs');
  });
});

describe('messageForError', () => {
  it('maps a known machine code in `code`', () => {
    expect(messageForError(new ApiError(401, { status: 401, title: 'x', code: 'invalid_credentials' }))).toBe('Incorrect username or password.');
  });
  it('maps a known code that arrives in `detail` (real API shape)', () => {
    expect(messageForError(new ApiError(409, { status: 409, title: 'x', detail: 'last_admin' }))).toBe('You cannot disable the last remaining admin.');
  });
  it('falls back by status when the code is unknown', () => {
    expect(messageForError(new ApiError(403, { status: 403, title: 'x' }))).toBe('You are not allowed to do that.');
    expect(messageForError(new ApiError(500, { status: 500, title: 'x' }))).toBe('Server error. Please try again.');
  });
  it('handles a non-ApiError', () => {
    expect(messageForError(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});

describe('notify helpers', () => {
  it('notifyError shows a red toast with the mapped message', () => {
    notifyError(new ApiError(404, { status: 404, title: 'x' }));
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Not found.' }));
  });
  it('notifySuccess shows a teal toast', () => {
    notifySuccess('Saved.');
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'teal', message: 'Saved.' }));
  });
});
