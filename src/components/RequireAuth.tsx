import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../features/auth/hooks';

/** Layout guard: asks the BFF who we are (the cookie is HttpOnly, so we can't
 *  read it client-side). Spinner while checking, bounce to /login if signed out. */
export function RequireAuth() {
  const me = useMe();
  if (me.isLoading) {
    return (
      <Center h="100vh">
        <Loader color="brand" />
      </Center>
    );
  }
  if (!me.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
