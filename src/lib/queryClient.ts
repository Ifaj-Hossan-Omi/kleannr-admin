import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError, notifyError } from './errors';

// Retry rules (FRONTEND_GUIDE §0.7): never retry 4xx; retry 5xx/network briefly.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => notifyError(error) }),
  mutationCache: new MutationCache({ onError: (error) => notifyError(error) }),
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
