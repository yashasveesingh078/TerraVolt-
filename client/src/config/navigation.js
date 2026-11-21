import {
  LayoutDashboard, Users, FileText, Package, ShoppingCart, ScanLine, HardHat,
  Wrench, LifeBuoy, Receipt, Landmark, Wallet, TrendingUp, UserCog, Settings,
} from 'lucide-react';

// Human-readable role names
export const roleLabels = {
  DIRECTOR: 'Director',
  SALES: 'Sales',
  TECHNICIAN: 'Technician',
  WAREHOUSE: 'Warehouse',
  SERVICE: 'Service desk',
  ACCOUNTS: 'Accounts',
};

// Where each role lands after login
export const homeByRole = {
  DIRECTOR: '/dashboard',
  SALES: '/leads',
  TECHNICIAN: '/my-jobs',
  WAREHOUSE: '/inventory',
  SERVICE: '/tickets',
  ACCOUNTS: '/invoices',
};

export function homePath(role) {
  return homeByRole[role] || '/login';
}

// Sidebar items. "roles" = who can see it (the director sees everything
// unless hideForDirector is true).
export const navItems = [
  { path: '/dashboard',       label: 'Dashboard',          icon: LayoutDashboard, roles: [] },
  { path: '/leads',           label: 'Leads',              icon: Users,           roles: ['SALES'] },
  { path: '/orders',          label: 'Quotes & orders',    icon: FileText,        roles: ['SALES', 'ACCOUNTS'] },
  { path: '/jobs',            label: 'Installation jobs',  icon: Wrench,          roles: ['SALES'] },
  { path: '/my-jobs',         label: 'My jobs',            icon: HardHat,         roles: ['TECHNICIAN'], hideForDirector: true },
  { path: '/inventory',       label: 'Inventory',          icon: Package,         roles: ['WAREHOUSE'] },
  { path: '/purchases',       label: 'Purchases',          icon: ShoppingCart,    roles: ['WAREHOUSE', 'ACCOUNTS'] },
  { path: '/serials',         label: 'Serial search',      icon: ScanLine,        roles: ['WAREHOUSE', 'SERVICE'] },
  { path: '/tickets',         label: 'Service tickets',    icon: LifeBuoy,        roles: ['SERVICE'] },
  { path: '/invoices',        label: 'Invoices',           icon: Receipt,         roles: ['ACCOUNTS'] },
  { path: '/subsidies',       label: 'Subsidies',          icon: Landmark,        roles: ['ACCOUNTS', 'SALES'] },
  { path: '/payroll',         label: 'Technician pay',     icon: Wallet,          roles: ['ACCOUNTS'] },
  { path: '/reports/monthly', label: 'Monthly report',     icon: TrendingUp,      roles: [] },
  { path: '/users',           label: 'Staff',              icon: UserCog,         roles: [] },
  { path: '/settings/sizing', label: 'Sizing rules',       icon: Settings,        roles: [] },
];

// The items one role should see in the sidebar
export function navForRole(role) {
  return navItems.filter((item) =>
    role === 'DIRECTOR' ? !item.hideForDirector : item.roles.includes(role)
  );
}