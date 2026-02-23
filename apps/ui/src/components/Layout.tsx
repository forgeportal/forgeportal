import { Outlet, NavLink } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { usePlugins } from '../plugins/PluginContext.js';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-700 text-white'
            : 'text-indigo-100 hover:bg-indigo-700 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { data: meData } = useCurrentUser();
  const { getRoutes }    = usePlugins();
  const user             = meData?.user;

  const pluginNavRoutes = getRoutes().filter((r) => r.navLabel);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-indigo-600 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-lg font-bold text-white tracking-tight">
                ⚡ ForgePortal
              </span>
              <div className="flex items-center gap-1">
                <NavItem to="/catalog"    label="Catalog" />
                <NavItem to="/templates"  label="Templates" />
                <NavItem to="/actions"    label="Actions" />
                <NavItem to="/scorecards" label="Scorecards" />
                {user?.role === 'platform-admin' && (
                  <NavItem to="/admin" label="Admin" />
                )}
                {/* Plugin-provided nav items */}
                {pluginNavRoutes.map((route) => (
                  <NavItem
                    key={route.path}
                    to={route.path}
                    label={route.navLabel!}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-300 text-xs font-semibold text-indigo-800">
                    {(user.name ?? user.email ?? '?')[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-indigo-100 hidden sm:block">
                    {user.name ?? user.email}
                  </span>
                </div>
              ) : (
                <div className="h-7 w-7 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
