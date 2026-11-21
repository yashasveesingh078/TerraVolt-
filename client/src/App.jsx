import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { homePath } from './config/navigation.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Placeholder from './pages/Placeholder.jsx';

// Short helper: only these roles (plus the director) can open this page
const only = (roles, page) => <ProtectedRoute roles={roles}>{page}</ProtectedRoute>;

// "/" sends each person to their own home page
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePath(user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* ---------- Public pages (no login) ---------- */}
      <Route path="/login" element={<Login />} />
      {/* Step 8: /enquiry   Step 10: /quote/:token */}

      {/* ---------- Staff pages: must be logged in, shown inside the Layout ---------- */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<HomeRedirect />} />

        <Route path="/dashboard"       element={only([], <Dashboard />)} />
        <Route path="/leads"           element={only(['SALES'], <Placeholder title="Leads" />)} />
        <Route path="/orders"          element={only(['SALES', 'ACCOUNTS'], <Placeholder title="Quotes & orders" />)} />
        <Route path="/jobs"            element={only(['SALES'], <Placeholder title="Installation jobs" />)} />
        <Route path="/my-jobs"         element={only(['TECHNICIAN'], <Placeholder title="My jobs" />)} />
        <Route path="/inventory"       element={only(['WAREHOUSE'], <Placeholder title="Inventory" />)} />
        <Route path="/purchases"       element={only(['WAREHOUSE', 'ACCOUNTS'], <Placeholder title="Purchases" />)} />
        <Route path="/serials"         element={only(['WAREHOUSE', 'SERVICE'], <Placeholder title="Serial search" />)} />
        <Route path="/tickets"         element={only(['SERVICE'], <Placeholder title="Service tickets" />)} />
        <Route path="/invoices"        element={only(['ACCOUNTS'], <Placeholder title="Invoices" />)} />
        <Route path="/subsidies"       element={only(['ACCOUNTS', 'SALES'], <Placeholder title="Subsidies" />)} />
        <Route path="/payroll"         element={only(['ACCOUNTS'], <Placeholder title="Technician pay" />)} />
        <Route path="/reports/monthly" element={only([], <Placeholder title="Monthly report" />)} />
        <Route path="/users"           element={only([], <Placeholder title="Staff" />)} />
        <Route path="/settings/sizing" element={only([], <Placeholder title="Sizing rules" />)} />
      </Route>

      {/* Unknown URL → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}