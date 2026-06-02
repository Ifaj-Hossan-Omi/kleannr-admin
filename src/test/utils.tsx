import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

/** A QueryClient with retries off — tests assert on first response, not retry behaviour. */
export const testQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

/** Render a component inside the providers it needs (Mantine theme + Query cache). */
export function renderWithProviders(ui: ReactNode, qc = testQueryClient()) {
  return render(
    <MantineProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MantineProvider>,
  );
}

/** Wrapper for `renderHook` — gives hooks a Query cache + Mantine context. */
export function queryWrapper(qc = testQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MantineProvider>
    );
  };
}
