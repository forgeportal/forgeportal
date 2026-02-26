import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { usePlugins }     from '../plugins/PluginContext.js';
import { useSearch }      from '../hooks/useSearch.js';
import Badge              from './Badge.js';
import Spinner            from './Spinner.js';

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
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

// Mobile-specific nav item (full-width, larger touch target)
function MobileNavItem({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `block w-full px-4 py-3 text-sm font-medium rounded-md transition-colors ${
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

// ─── GlobalSearch ─────────────────────────────────────────────────────────────

function GlobalSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [query,      setQuery]      = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [open,       setOpen]       = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(-1);

  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate     = useNavigate();
  const location     = useLocation();

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setQuery('');
    setDebouncedQ('');
  }, [location.pathname]);

  // Cmd+K / Ctrl+K + Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setQuery('');
        setDebouncedQ('');
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setActiveIdx(-1); }, [debouncedQ]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchQ = debouncedQ.length >= 2 ? debouncedQ : '';
  const { data, isLoading } = useSearch(searchQ);
  const results = data?.data.slice(0, 6) ?? [];
  const shouldShow = open && debouncedQ.length >= 2;

  const selectResult = useCallback((url: string) => {
    navigate(url);
    setOpen(false);
    setQuery('');
    setDebouncedQ('');
    inputRef.current?.blur();
    onNavigate?.();
  }, [navigate, onNavigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShow) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIdx] ?? results[0];
      if (target) selectResult(target.url);
    }
  };

  const excerpt = (html: string) => {
    const plain = html.replace(/<[^>]+>/g, '');
    return plain.length > 60 ? plain.slice(0, 57) + '…' : plain;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search… ⌘K"
          aria-label="Global search"
          aria-expanded={shouldShow}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          className={`bg-indigo-700/50 border border-indigo-500 text-white placeholder-indigo-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 transition-all duration-200 ${
            open && query ? 'w-64 sm:w-72' : 'w-40 sm:w-48'
          }`}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {shouldShow && (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-gray-200 bg-white shadow-xl z-50 overflow-hidden"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">
              No results for &ldquo;{debouncedQ}&rdquo;
            </div>
          ) : (
            results.map((item, i) => (
              <button
                key={`${item.type}-${item.id}`}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => { e.preventDefault(); selectResult(item.url); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === activeIdx ? 'bg-indigo-50' : 'hover:bg-gray-50'
                } ${i < results.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="shrink-0 mt-0.5">
                  <Badge label={item.type} variant={item.type === 'entity' ? 'kind' : 'tag'} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  {item.excerpt && (
                    <p className="text-xs text-gray-400 truncate">{excerpt(item.excerpt)}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout() {
  const { data: meData } = useCurrentUser();
  const { getRoutes }    = usePlugins();
  const user             = meData?.user;
  const [mobileOpen, setMobileOpen] = useState(false);

  const pluginNavRoutes = getRoutes().filter((r) => r.navLabel);

  const navLinks = [
    { to: '/',          label: 'Home' },
    { to: '/catalog',   label: 'Catalog' },
    { to: '/templates', label: 'Templates' },
    { to: '/actions',   label: 'Actions' },
    { to: '/scorecards', label: 'Scorecards' },
    ...(user?.role === 'platform-admin' ? [{ to: '/admin', label: 'Admin' }] : []),
    ...pluginNavRoutes.map((r) => ({ to: r.path, label: r.navLabel! })),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-indigo-600 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3">

            {/* Logo + desktop nav */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <span className="text-lg font-bold text-white tracking-tight shrink-0">
                ⚡ ForgePortal
              </span>

              {/* Desktop nav — hidden on mobile */}
              <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {navLinks.map((link) => (
                  <NavItem key={link.to} to={link.to} label={link.label} />
                ))}
              </div>
            </div>

            {/* Right side: search + avatar + hamburger */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Search — hidden on smallest screens to save space */}
              <div className="hidden sm:block">
                <GlobalSearch onNavigate={() => setMobileOpen(false)} />
              </div>

              {/* User avatar */}
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-300 text-xs font-semibold text-indigo-800 shrink-0">
                    {(user.name ?? user.email ?? '?')[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-indigo-100 hidden lg:block">
                    {user.name ?? user.email}
                  </span>
                </div>
              ) : (
                <div className="h-7 w-7 rounded-full bg-indigo-400 animate-pulse" />
              )}

              {/* Hamburger button — mobile only */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-indigo-100 hover:bg-indigo-700 transition-colors"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-indigo-700 bg-indigo-600">
            <div className="px-4 py-3 space-y-1">
              {/* Mobile search */}
              <div className="pb-2">
                <GlobalSearch onNavigate={() => setMobileOpen(false)} />
              </div>
              {navLinks.map((link) => (
                <MobileNavItem
                  key={link.to}
                  to={link.to}
                  label={link.label}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
