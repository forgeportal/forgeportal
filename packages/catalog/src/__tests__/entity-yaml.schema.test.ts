import { describe, it, expect } from 'vitest';
import { entityYamlSchema } from '../entity-yaml.schema.js';

const validMinimal = {
  apiVersion: 'forgeportal/v1',
  kind: 'service',
  metadata: { name: 'my-service' },
};

const validFull = {
  apiVersion: 'forgeportal/v1',
  kind: 'service',
  metadata: {
    name: 'orders-api',
    namespace: 'backend',
    description: 'Orders service',
    tags: ['node', 'api'],
    links: [{ title: 'Docs', url: 'https://example.com/docs' }],
  },
  spec: {
    owner: 'team:backend',
    lifecycle: 'production',
    dependsOn: ['service:default/postgres'],
    providesApi: ['api:default/orders-rest'],
    consumesApi: [],
    customField: 'preserved',
  },
};

describe('entityYamlSchema', () => {
  it('valid full entity.yaml passes', () => {
    const result = entityYamlSchema.safeParse(validFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.name).toBe('orders-api');
      expect(result.data.spec.owner).toBe('team:backend');
    }
  });

  it('missing apiVersion fails', () => {
    const { apiVersion: _, ...noVersion } = validMinimal;
    const result = entityYamlSchema.safeParse(noVersion);
    expect(result.success).toBe(false);
  });

  it('wrong apiVersion fails', () => {
    const result = entityYamlSchema.safeParse({
      ...validMinimal,
      apiVersion: 'backstage/v1',
    });
    expect(result.success).toBe(false);
  });

  it('missing kind fails', () => {
    const { kind: _, ...noKind } = validMinimal;
    const result = entityYamlSchema.safeParse(noKind);
    expect(result.success).toBe(false);
  });

  it('unknown kind fails', () => {
    const result = entityYamlSchema.safeParse({
      ...validMinimal,
      kind: 'microservice',
    });
    expect(result.success).toBe(false);
  });

  it('minimal entity.yaml with defaults applied passes', () => {
    const result = entityYamlSchema.safeParse(validMinimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.namespace).toBe('default');
      expect(result.data.metadata.tags).toEqual([]);
      expect(result.data.metadata.links).toEqual([]);
      expect(result.data.metadata.annotations).toEqual({});
      expect(result.data.spec.dependsOn).toEqual([]);
    }
  });

  it('metadata.annotations are parsed correctly', () => {
    const yaml = {
      ...validMinimal,
      metadata: {
        ...validMinimal.metadata,
        annotations: {
          'forgeportal.dev/k8s-label-selector': 'app=payment-api',
          'forgeportal.dev/argocd-app-name': 'payment-api-prod',
        },
      },
    };
    const result = entityYamlSchema.safeParse(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.annotations).toEqual({
        'forgeportal.dev/k8s-label-selector': 'app=payment-api',
        'forgeportal.dev/argocd-app-name': 'payment-api-prod',
      });
    }
  });

  it('annotations with non-string values fail', () => {
    const yaml = {
      ...validMinimal,
      metadata: {
        ...validMinimal.metadata,
        annotations: { 'some.key': 42 },
      },
    };
    const result = entityYamlSchema.safeParse(yaml);
    expect(result.success).toBe(false);
  });

  it('spec passthrough preserves extra fields', () => {
    const result = entityYamlSchema.safeParse(validFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.spec as Record<string, unknown>)['customField']).toBe(
        'preserved',
      );
    }
  });
});
