import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Route guard: everything except /login needs a signed-in player. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <p role="status">Checking your session…</p>;
  if (status === 'signedOut')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
