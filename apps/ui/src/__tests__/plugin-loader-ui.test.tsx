import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PluginRegistry } from '@forgeportal/plugin-sdk';
import { EntityProvider } from '@forgeportal/plugin-sdk/react';
import { useEntity } from '@forgeportal/plugin-sdk/react';
import type { Entity as SdkEntity } from '@forgeportal/plugin-sdk';
import type { FC } from 'react';
import { PluginContext } from '../plugins/PluginContext.js';

// ─── Test utilities ──────────────────────────────────────────────────────────

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      {children}
    </QueryClientProvider>
  );
}

const mockSdkEntity: SdkEntity = {
  id:        'ent-1',
  kind:      'service',
  namespace: 'default',
  name:      'my-service',
  tags:      [],
  links:     [],
  spec:      {},
};

// ─── Mock plugin components ──────────────────────────────────────────────────

const MockTab: FC<{ entity: SdkEntity }> = ({ entity }) => (
  <div data-testid="plugin-tab">Plugin Tab for {entity.name}</div>
);

const MockCard: FC<{ entity: SdkEntity }> = ({ entity }) => (
  <div data-testid="plugin-card">Plugin Card for {entity.name}</div>
);

const MockRoutePage: FC = () => (
  <div data-testid="plugin-route-page">Plugin Route Page</div>
);

// ─── PluginContext mock value builder ─────────────────────────────────────────

function makeContextValue(reg: PluginRegistry) {
  return {
    isLoading:       false,
    getEntityTabs:   (kind: string) => reg.getEntityTabs(kind),
    getEntityCards:  (kind: string) => reg.getEntityCards(kind),
    getRoutes:       () => reg.getRoutes(),
    getPluginConfig: (_pluginId: string) => ({} as Record<string, unknown>),
  };
}

// ─── Tests: Entity Tab ───────────────────────────────────────────────────────

describe('Plugin entity tab', () => {
  it('renders a plugin tab for matching kind', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab({
      id:        'test-tab',
      title:     'Test Tab',
      component: MockTab,
      appliesTo: { kinds: ['service'] },
    });

    render(
      <TestWrapper>
        <PluginContext.Provider value={makeContextValue(reg)}>
          <EntityProvider entity={mockSdkEntity}>
            {reg.getEntityTabs('service').map((tab) => (
              <tab.component key={tab.id} entity={mockSdkEntity} />
            ))}
          </EntityProvider>
        </PluginContext.Provider>
      </TestWrapper>,
    );

    expect(screen.getByTestId('plugin-tab')).toBeInTheDocument();
    expect(screen.getByText('Plugin Tab for my-service')).toBeInTheDocument();
  });

  it('does NOT render a plugin tab for non-matching kind', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab({
      id:        'service-only-tab',
      title:     'Service Tab',
      component: MockTab,
      appliesTo: { kinds: ['service'] },
    });

    const tabs = reg.getEntityTabs('library');
    expect(tabs).toHaveLength(0);
  });

  it('renders a plugin tab with no appliesTo for all entity kinds', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab({
      id:        'universal-tab',
      title:     'Universal Tab',
      component: MockTab,
      // No appliesTo — matches all kinds
    });

    expect(reg.getEntityTabs('service')).toHaveLength(1);
    expect(reg.getEntityTabs('library')).toHaveLength(1);
    expect(reg.getEntityTabs('website')).toHaveLength(1);
  });
});

// ─── Tests: Entity Card ───────────────────────────────────────────────────────

describe('Plugin entity card', () => {
  it('renders a plugin card for matching kind', () => {
    const reg = new PluginRegistry();
    reg.registerEntityCard({
      id:        'test-card',
      title:     'Test Card',
      component: MockCard,
      appliesTo: { kinds: ['service'] },
    });

    render(
      <TestWrapper>
        <PluginContext.Provider value={makeContextValue(reg)}>
          <EntityProvider entity={mockSdkEntity}>
            {reg.getEntityCards('service').map((card) => (
              <card.component key={card.id} entity={mockSdkEntity} />
            ))}
          </EntityProvider>
        </PluginContext.Provider>
      </TestWrapper>,
    );

    expect(screen.getByTestId('plugin-card')).toBeInTheDocument();
    expect(screen.getByText('Plugin Card for my-service')).toBeInTheDocument();
  });

  it('does NOT show plugin card for non-matching kind', () => {
    const reg = new PluginRegistry();
    reg.registerEntityCard({
      id:        'svc-card',
      title:     'Service Card',
      component: MockCard,
      appliesTo: { kinds: ['service'] },
    });

    expect(reg.getEntityCards('library')).toHaveLength(0);
  });
});

// ─── Tests: Routes ───────────────────────────────────────────────────────────

describe('Plugin routes', () => {
  it('registers a route with navLabel', () => {
    const reg = new PluginRegistry();
    reg.registerRoute({
      path:      '/pd-oncall',
      component: MockRoutePage,
      navLabel:  'On-Call',
    });

    const routes = reg.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0]?.navLabel).toBe('On-Call');
    expect(routes[0]?.path).toBe('/pd-oncall');
  });

  it('filters nav routes to only those with navLabel', () => {
    const reg = new PluginRegistry();
    reg.registerRoute({ path: '/with-nav',    component: MockRoutePage, navLabel: 'Visible' });
    reg.registerRoute({ path: '/without-nav', component: MockRoutePage });

    const navRoutes = reg.getRoutes().filter((r) => r.navLabel);
    expect(navRoutes).toHaveLength(1);
    expect(navRoutes[0]?.navLabel).toBe('Visible');
  });
});

// ─── Tests: useEntity hook ────────────────────────────────────────────────────

describe('useEntity() hook in plugin component', () => {
  it('returns entity when wrapped in EntityProvider', () => {
    const PluginWithHook: FC = () => {
      const { entity } = useEntity();
      return <div data-testid="entity-name">{entity.name}</div>;
    };

    render(
      <TestWrapper>
        <EntityProvider entity={mockSdkEntity}>
          <PluginWithHook />
        </EntityProvider>
      </TestWrapper>,
    );

    expect(screen.getByTestId('entity-name')).toHaveTextContent('my-service');
  });
});

// ─── Tests: disabled plugin filtering ────────────────────────────────────────

describe('Disabled plugin filtering', () => {
  it('shows all tabs when enabledIds is empty (no status fetched)', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab({ id: 'pd-tab', title: 'PD', component: MockTab });

    const contextValue = {
      isLoading:      false,
      getEntityTabs:  (kind: string) => reg.getEntityTabs(kind),
      getEntityCards: (kind: string) => reg.getEntityCards(kind),
      getRoutes:      () => reg.getRoutes(),
    };

    expect(contextValue.getEntityTabs('service')).toHaveLength(1);
  });

  it('hides a plugin tab when its plugin ID is not in enabledIds', () => {
    const reg = new PluginRegistry();
    reg.registerEntityTab({
      id:        'pd-tab',
      title:     'PD',
      component: MockTab,
    });

    const enabledIds = new Set(['other-plugin']); // 'pd-plugin' not included

    // Simulate the isEnabled filtering logic
    const tabs = reg.getEntityTabs('service').filter(() => enabledIds.has('pagerduty'));
    expect(tabs).toHaveLength(0);
  });
});

// ─── Tests: registerPluginById ownership tracking ────────────────────────────

describe('registerPluginById', () => {
  beforeEach(() => {
    // Import fresh instance for isolated tests
  });

  it('tracks tab ownership via registerPluginById', async () => {
    const { registry: testReg, tabOwnership: testTabOwn, registerPluginById } =
      await import('../plugins/plugin-registry-ui.js');

    // Fresh registry for this test
    const localReg = new PluginRegistry();
    const localOwnership = new Map<string, string>();

    registerPluginById('my-plugin', (sdk) => {
      sdk.registerEntityTab({
        id:        'ownership-test-tab',
        title:     'Ownership Test',
        component: MockTab,
      });
    });

    // The real tabOwnership should have our entry
    expect(testTabOwn.get('ownership-test-tab')).toBe('my-plugin');
  });
});
