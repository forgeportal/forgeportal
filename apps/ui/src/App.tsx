import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout            from './components/Layout.js';
import HomePage          from './pages/HomePage.js';
import CatalogListPage   from './pages/CatalogListPage.js';
import EntityDetailPage  from './pages/EntityDetailPage.js';
import TemplatesListPage  from './pages/TemplatesListPage.js';
import TemplateDetailPage from './pages/TemplateDetailPage.js';
import TemplateRunPage    from './pages/TemplateRunPage.js';
import ActionRunsListPage from './pages/ActionRunsListPage.js';
import ScorecardsPage      from './pages/ScorecardsPage.js';
import ScorecardsAdminPage from './pages/ScorecardsAdminPage.js';
import AdminLayout from './pages/admin/AdminLayout.js';
import AdminIntegrationsPage from './pages/admin/AdminIntegrationsPage.js';
import AdminPermissionsPage from './pages/admin/AdminPermissionsPage.js';
import AdminPluginsPage from './pages/admin/AdminPluginsPage.js';
import AdminScanPage from './pages/admin/AdminScanPage.js';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage.js';
import AdminSetupPage from './pages/admin/AdminSetupPage.js';
import { useEffect }  from 'react';
import { usePlugins } from './plugins/PluginContext.js';
import { useBranding } from './hooks/useBranding.js';

export default function App() {
  const { getRoutes } = usePlugins();
  const pluginRoutes  = getRoutes();
  const branding      = useBranding();

  useEffect(() => {
    document.title = branding.portalName;
  }, [branding.portalName]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/catalog"     element={<CatalogListPage />} />
          <Route path="/catalog/:id" element={<EntityDetailPage />} />

          {/* Template routes — nested to avoid /templates/:id matching "runs" */}
          <Route path="/templates">
            <Route index              element={<TemplatesListPage />} />
            <Route path="runs/:runId" element={<TemplateRunPage />} />
            <Route path=":id"         element={<TemplateDetailPage />} />
          </Route>

          <Route path="/actions" element={<ActionRunsListPage />} />

          {/* Scorecards — admin route first (more specific) */}
          <Route path="/scorecards">
            <Route index        element={<ScorecardsPage />} />
            <Route path="admin" element={<ScorecardsAdminPage />} />
          </Route>

          {/* Admin — platform-admin only */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/integrations" replace />} />
            <Route path="integrations" element={<AdminIntegrationsPage />} />
            <Route path="permissions" element={<AdminPermissionsPage />} />
            <Route path="plugins" element={<AdminPluginsPage />} />
            <Route path="scan" element={<AdminScanPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="setup" element={<AdminSetupPage />} />
          </Route>

          {/* Plugin-registered routes */}
          {pluginRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.component />}
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
