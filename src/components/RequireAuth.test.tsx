import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../features/auth/hooks', () => ({ useMe: vi.fn() }));
import { useMe } from '../features/auth/hooks';
import { RequireAuth } from './RequireAuth';

const mockedUseMe = vi.mocked(useMe);
// RequireAuth only reads `isLoading` + `data`, so a partial shape is enough.
const meResult = (o: { isLoading: boolean; data: unknown }) => o as unknown as ReturnType<typeof useMe>;

function renderGuard() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>protected content</div>} />
          </Route>
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => mockedUseMe.mockReset());

  it('renders the outlet when authenticated', () => {
    mockedUseMe.mockReturnValue(meResult({ isLoading: false, data: { user: { id: 'a', name: 'admin', role: 3 } } }));
    renderGuard();
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects to /login when signed out', () => {
    mockedUseMe.mockReturnValue(meResult({ isLoading: false, data: null }));
    renderGuard();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('shows a spinner (neither page) while the session check is in flight', () => {
    mockedUseMe.mockReturnValue(meResult({ isLoading: true, data: undefined }));
    renderGuard();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});
