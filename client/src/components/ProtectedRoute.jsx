import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homePath } from '../config/navigation.js';

// Wrap any page with this.
// - Not logged in  → go to /login (and remember where they wanted to go)
// - Wrong role     → go to their own home page
// roles = list of allowed roles; the director is always allowed.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still asking the server "who am I?" → show a short loading message
  if (loading) {
    return <div className="p-10 text-center text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  // Not logged in → send to the login page
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Logged in but not allowed on this page → send to their own home page
  if (roles && user.role !== 'DIRECTOR' && !roles.includes(user.role)) {
    return <Navigate to={homePath(user.role)} replace />;
  }

  // Allowed → show the page
  return children;
}