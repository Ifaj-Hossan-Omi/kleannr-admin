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

/** Stage 2 TOTP verify. */
export function useTotpVerify() {
  return useMutation({ mutationFn: (vars: { code: string }) => totpVerify(vars.code) });
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
