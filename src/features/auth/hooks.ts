import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminLogin, fetchMe, logout, totpConfirm, totpSetup, totpVerify } from './api';
import { redirectToLogin } from '../../lib/navigation';

/** Session query for the route guard. `data` is `{ user }` or `null` (signed out). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false, staleTime: 60_000 });
}

/** Stage 1 password login. The BFF sets the session cookie; we just read the outcome. */
export function useAdminLogin() {
  return useMutation({
    mutationFn: (vars: { username: string; password: string }) => adminLogin(vars.username, vars.password),
  });
}

/** Stage 2 TOTP verify. Seeds the `me` cache from the response so the route guard
 *  renders immediately and doesn't depend on a fresh `/bff/me` round-trip (KV is
 *  eventually-consistent — see the id-rotation note in worker `handleTotp`). */
export function useTotpVerify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { code: string }) => totpVerify(vars.code),
    onSuccess: (res) => {
      if (res?.user) qc.setQueryData(['me'], { user: res.user });
    },
  });
}

export function useTotpSetup() {
  return useMutation({ mutationFn: () => totpSetup() });
}

export function useTotpConfirm() {
  return useMutation({ mutationFn: (vars: { code: string }) => totpConfirm(vars.code) });
}

/** Logout: the BFF revokes upstream + clears the cookie; we drop the session query + redirect. */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      qc.removeQueries({ queryKey: ['me'] });
      redirectToLogin();
    },
  });
}
