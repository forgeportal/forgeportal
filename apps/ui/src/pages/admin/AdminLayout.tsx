import { Outlet, NavLink } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';
import Spinner from '../../components/Spinner.js';

function AdminNavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function AdminLayout() {
  const { data: meData, isLoading } = useCurrentUser();
  const user = meData?.user;
  const isPlatformAdmin = user?.role === 'platform-admin';

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <h2 className="text-lg font-semibold text-amber-800">Accès refusé</h2>
        <p className="mt-2 text-sm text-amber-700">
          Seuls les utilisateurs avec le rôle <strong>platform-admin</strong> peuvent accéder à cette section.
        </p>
        <NavLink
          to="/catalog"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Retour au catalogue
        </NavLink>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <nav className="mt-3 flex flex-wrap gap-1">
          <AdminNavItem to="/admin/setup" label="Setup Wizard" />
          <AdminNavItem to="/admin/integrations" label="Integrations" />
          <AdminNavItem to="/admin/permissions" label="Permissions" />
          <AdminNavItem to="/admin/plugins" label="Plugins" />
          <AdminNavItem to="/admin/scan" label="Scan" />
          <AdminNavItem to="/admin/audit-logs" label="Audit Logs" />
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
