import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { homePath } from './config/navigation.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Enquiry from './pages/Enquiry.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Placeholder from './pages/Placeholder.jsx';
import Leads from './pages/Leads.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import Surveys from './pages/Surveys.jsx';
import SurveyForm from './pages/SurveyForm.jsx';
import Quote from './pages/Quote.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Inventory from './pages/Inventory.jsx';
import Dispatch from './pages/Dispatch.jsx';
import SerialSearch from './pages/SerialSearch.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Tickets from './pages/Tickets.jsx';
import TicketDetail from './pages/TicketDetail.jsx';
import Invoices from './pages/Invoices.jsx';
import Subsidies from './pages/Subsidies.jsx';
import Payroll from './pages/Payroll.jsx';
import MonthlyReport from './pages/MonthlyReport.jsx';
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
      <Route path="/enquiry" element={<Enquiry />} />
      <Route path="/quote/:token" element={<Quote />} />

      {/* ---------- Staff pages: must be logged in, shown inside the Layout ---------- */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<HomeRedirect />} />

        <Route path="/dashboard"       element={only([], <Dashboard />)} />
        <Route path="/leads" element={only(['SALES'], <Leads />)} />
        <Route path="/leads/:id" element={only(['SALES'], <LeadDetail />)} />
        <Route path="/surveys" element={only(['SALES', 'TECHNICIAN'], <Surveys />)} />
        <Route path="/surveys/:id" element={only(['SALES', 'TECHNICIAN'], <SurveyForm />)} />
        <Route path="/orders" element={only(['SALES', 'ACCOUNTS'], <Orders />)} />
        <Route path="/orders/:id" element={only(['SALES', 'ACCOUNTS'], <OrderDetail />)} />
      <Route path="/jobs" element={only(['SALES'], <Jobs />)} />
<Route path="/my-jobs" element={only(['TECHNICIAN'], <Jobs />)} />
<Route path="/jobs/:id" element={only(['SALES', 'TECHNICIAN'], <JobDetail />)} />
       <Route path="/inventory" element={only(['WAREHOUSE'], <Inventory />)} />
       <Route path="/inventory/dispatch/:id" element={only(['WAREHOUSE'], <Dispatch />)} />
        <Route path="/purchases"       element={only(['WAREHOUSE', 'ACCOUNTS'], <Placeholder title="Purchases" />)} />
       <Route path="/serials" element={only(['WAREHOUSE', 'SERVICE'], <SerialSearch />)} />
     <Route path="/tickets" element={only(['SERVICE'], <Tickets />)} />
<Route path="/tickets/:id" element={only(['SERVICE'], <TicketDetail />)} />
        <Route path="/invoices" element={only(['ACCOUNTS'], <Invoices />)} />
       <Route path="/invoices" element={only(['ACCOUNTS'], <Invoices />)} />
<Route path="/subsidies" element={only(['ACCOUNTS', 'SALES'], <Subsidies />)} />
        <Route path="/payroll" element={only(['ACCOUNTS'], <Payroll />)} />

      <Route path="/reports/monthly" element={only([], <MonthlyReport />)} />
        <Route path="/users"           element={only([], <Placeholder title="Staff" />)} />
        <Route path="/settings/sizing" element={only([], <Placeholder title="Sizing rules" />)} />
      </Route>

      {/* Unknown URL → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}