import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '../../test/msw';
import { queryWrapper } from '../../test/utils';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

import { useCreateWashType, useWashTypes } from './hooks';

describe('catalog hooks', () => {
  it('useWashTypes reads /admin/wash-types', async () => {
    server.use(
      http.get('*/bff/api/admin/wash-types', () =>
        HttpResponse.json([{ id: 'w1', name: 'Regular Wash', description: null, isActive: true, sortOrder: 1 }]),
      ),
    );
    const { result } = renderHook(() => useWashTypes(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe('Regular Wash');
  });

  it('useCreateWashType POSTs the body to /admin/wash-types', async () => {
    let posted: unknown = null;
    server.use(
      http.post('*/bff/api/admin/wash-types', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ id: 'new-id' }, { status: 201 });
      }),
    );
    const { result } = renderHook(() => useCreateWashType(), { wrapper: queryWrapper() });
    result.current.mutate({ name: 'Steam Press', description: null, sortOrder: 5 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(posted).toEqual({ name: 'Steam Press', description: null, sortOrder: 5 });
  });
});
