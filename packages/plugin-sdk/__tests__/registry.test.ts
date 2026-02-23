import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../src/registry.js';
import type { EntityTab, EntityCard, Route, ActionProvider, CatalogProvider } from '../src/types.js';

// ─── Test fixtures ─────────────────────────────────────────────────────────

function makeTab(id: string, kinds?: string[]): EntityTab {
  return {
    id,
    title:     `Tab ${id}`,
    component: () => null,
    appliesTo: kinds ? { kinds } : undefined,
  };
}

function makeCard(id: string, kinds?: string[]): EntityCard {
  return {
    id,
    title:     `Card ${id}`,
    component: () => null,
    appliesTo: kinds ? { kinds } : undefined,
  };
}

function makeRoute(path: string, navLabel?: string): Route {
  return { path, component: () => null, navLabel };
}

function makeActionProvider(id: string, version = 'v1'): ActionProvider {
  return {
    id,
    version,
    schema:  { input: { type: 'object', properties: {} } },
    handler: vi.fn().mockResolvedValue({ status: 'success', outputs: {} }),
  };
}

function makeCatalogProvider(id: string): CatalogProvider {
  return {
    id,
    async *ingest() { /* yields nothing */ },
  };
}

// ─── EntityTab tests ────────────────────────────────────────────────────────

describe('PluginRegistry — EntityTab', () => {
  it('registers a tab and retrieves it', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab(makeTab('tab-a'));
    expect(reg.getEntityTabs()).toHaveLength(1);
    expect(reg.getEntityTabs()[0]?.id).toBe('tab-a');
  });

  it('skips duplicate registration (warns)', () => {
    const reg = new PluginRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reg.registerEntityTab(makeTab('tab-dup'));
    reg.registerEntityTab(makeTab('tab-dup'));
    expect(reg.getEntityTabs()).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('filters tabs by entity kind — matching kind', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab(makeTab('tab-svc', ['service']));
    reg.registerEntityTab(makeTab('tab-all'));           // no kinds = all
    const tabs = reg.getEntityTabs('service');
    expect(tabs.map(t => t.id)).toEqual(['tab-svc', 'tab-all']);
  });

  it('filters tabs by entity kind — non-matching kind', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab(makeTab('tab-svc', ['service']));
    reg.registerEntityTab(makeTab('tab-all'));
    const tabs = reg.getEntityTabs('library');
    expect(tabs.map(t => t.id)).toEqual(['tab-all']);
  });

  it('returns all tabs when no kind filter provided', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab(makeTab('a', ['service']));
    reg.registerEntityTab(makeTab('b', ['library']));
    expect(reg.getEntityTabs()).toHaveLength(2);
  });
});

// ─── EntityCard tests ───────────────────────────────────────────────────────

describe('PluginRegistry — EntityCard', () => {
  it('registers and retrieves a card', () => {
    const reg = new PluginRegistry();
    reg.registerEntityCard(makeCard('card-a'));
    expect(reg.getEntityCards()).toHaveLength(1);
  });

  it('skips duplicate cards', () => {
    const reg = new PluginRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reg.registerEntityCard(makeCard('card-dup'));
    reg.registerEntityCard(makeCard('card-dup'));
    expect(reg.getEntityCards()).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it('filters cards by entity kind', () => {
    const reg = new PluginRegistry();
    reg.registerEntityCard(makeCard('c-svc', ['service']));
    reg.registerEntityCard(makeCard('c-all'));
    expect(reg.getEntityCards('library').map(c => c.id)).toEqual(['c-all']);
    expect(reg.getEntityCards('service').map(c => c.id)).toEqual(['c-svc', 'c-all']);
  });
});

// ─── Route tests ────────────────────────────────────────────────────────────

describe('PluginRegistry — Route', () => {
  it('registers routes and retrieves them', () => {
    const reg = new PluginRegistry();
    reg.registerRoute(makeRoute('/pd', 'PagerDuty'));
    reg.registerRoute(makeRoute('/slack'));
    const routes = reg.getRoutes();
    expect(routes).toHaveLength(2);
    expect(routes[0]?.navLabel).toBe('PagerDuty');
    expect(routes[1]?.navLabel).toBeUndefined();
  });

  it('skips duplicate routes by path', () => {
    const reg = new PluginRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reg.registerRoute(makeRoute('/pd'));
    reg.registerRoute(makeRoute('/pd'));
    expect(reg.getRoutes()).toHaveLength(1);
    warnSpy.mockRestore();
  });
});

// ─── ActionProvider tests ────────────────────────────────────────────────────

describe('PluginRegistry — ActionProvider', () => {
  it('registers action providers by id@version key', () => {
    const reg = new PluginRegistry();
    reg.registerActionProvider(makeActionProvider('slack.send', 'v1'));
    reg.registerActionProvider(makeActionProvider('slack.send', 'v2'));
    expect(reg.getActionProviders()).toHaveLength(2);
  });

  it('retrieves a specific action provider by id and version', () => {
    const reg = new PluginRegistry();
    const provider = makeActionProvider('pd.create', 'v1');
    reg.registerActionProvider(provider);
    expect(reg.getActionProvider('pd.create', 'v1')).toBe(provider);
    expect(reg.getActionProvider('pd.create', 'v2')).toBeUndefined();
  });

  it('skips duplicate id@version', () => {
    const reg = new PluginRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reg.registerActionProvider(makeActionProvider('x', 'v1'));
    reg.registerActionProvider(makeActionProvider('x', 'v1'));
    expect(reg.getActionProviders()).toHaveLength(1);
    warnSpy.mockRestore();
  });
});

// ─── CatalogProvider tests ────────────────────────────────────────────────────

describe('PluginRegistry — CatalogProvider', () => {
  it('registers catalog providers', () => {
    const reg = new PluginRegistry();
    reg.registerCatalogProvider(makeCatalogProvider('pd-catalog'));
    expect(reg.getCatalogProviders()).toHaveLength(1);
  });

  it('skips duplicate catalog provider IDs', () => {
    const reg = new PluginRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reg.registerCatalogProvider(makeCatalogProvider('dup'));
    reg.registerCatalogProvider(makeCatalogProvider('dup'));
    expect(reg.getCatalogProviders()).toHaveLength(1);
    warnSpy.mockRestore();
  });
});

// ─── Registry isolation ───────────────────────────────────────────────────────

describe('PluginRegistry — isolation', () => {
  it('two registry instances do not share state', () => {
    const a = new PluginRegistry();
    const b = new PluginRegistry();
    a.registerEntityTab(makeTab('shared-tab'));
    expect(b.getEntityTabs()).toHaveLength(0);
  });
});
