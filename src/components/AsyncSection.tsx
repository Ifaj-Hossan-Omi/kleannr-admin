import { Button, Center, Loader, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';

const MIN_H = 220;

/** Centered spinner while a section's data loads. */
export function LoadingState() {
  return (
    <Center mih={MIN_H}>
      <Loader color="brand" />
    </Center>
  );
}

/** Inline error with a retry. The global toast already surfaced the message. */
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Center mih={MIN_H}>
      <Stack align="center" gap="sm">
        <Text c="dimmed" size="sm">
          Couldn’t load this. Check your connection and try again.
        </Text>
        {onRetry && (
          <Button variant="light" color="brand" radius="xl" onClick={onRetry}>
            Retry
          </Button>
        )}
      </Stack>
    </Center>
  );
}

/** Friendly empty-state copy for a section with no rows yet. */
export function EmptyState({ message }: { message: ReactNode }) {
  return (
    <Center mih={MIN_H}>
      <Text c="dimmed" size="sm" ta="center" maw={380}>
        {message}
      </Text>
    </Center>
  );
}

/**
 * Renders the right UI for one query's lifecycle, so every wired screen handles
 * loading / error / empty consistently:
 *  - loading → spinner
 *  - error → inline retry (the global error toast has already fired)
 *  - empty (optional predicate + `empty` node) → `empty`
 *  - success → `children(data)`
 */
export function AsyncSection<T>({
  query,
  isEmpty,
  empty,
  children,
}: {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
