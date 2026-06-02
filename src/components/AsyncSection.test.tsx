import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import { AsyncSection } from './AsyncSection';
import { renderWithProviders } from '../test/utils';

// AsyncSection only reads isPending / isError / data / refetch — a partial cast is enough.
const fakeQuery = <T,>(o: Partial<UseQueryResult<T>>) => o as UseQueryResult<T>;

describe('AsyncSection', () => {
  it('renders children with the data on success', () => {
    renderWithProviders(
      <AsyncSection query={fakeQuery<number[]>({ isPending: false, isError: false, data: [1, 2] })}>
        {(d) => <div>rows:{d.length}</div>}
      </AsyncSection>,
    );
    expect(screen.getByText('rows:2')).toBeInTheDocument();
  });

  it('renders the empty node when the predicate says empty', () => {
    renderWithProviders(
      <AsyncSection query={fakeQuery<number[]>({ isPending: false, isError: false, data: [] })} isEmpty={(d) => d.length === 0} empty={<div>nothing here</div>}>
        {() => <div>rows</div>}
      </AsyncSection>,
    );
    expect(screen.getByText('nothing here')).toBeInTheDocument();
    expect(screen.queryByText('rows')).not.toBeInTheDocument();
  });

  it('renders an error with a Retry that calls refetch', async () => {
    const refetch = vi.fn();
    renderWithProviders(
      <AsyncSection query={fakeQuery<number[]>({ isPending: false, isError: true, refetch })}>
        {() => <div>rows</div>}
      </AsyncSection>,
    );
    const btn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(btn);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not render children or an error while pending', () => {
    renderWithProviders(
      <AsyncSection query={fakeQuery<number[]>({ isPending: true, isError: false })}>
        {() => <div>rows</div>}
      </AsyncSection>,
    );
    expect(screen.queryByText('rows')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});
