import { describe, it, expect, afterEach } from 'vitest';
import { toPluginEnvVarName, resolvePluginConfig } from '../secret-resolver.js';

describe('toPluginEnvVarName', () => {
  it('simple plugin id and key', () => {
    expect(toPluginEnvVarName('pagerduty', 'apiToken')).toBe('FORGEPORTAL_PLUGIN_PAGERDUTY_APITOKEN');
  });

  it('hyphenated plugin id', () => {
    expect(toPluginEnvVarName('slack-notify', 'webhookUrl')).toBe('FORGEPORTAL_PLUGIN_SLACK_NOTIFY_WEBHOOKURL');
  });

  it('multi-hyphen id', () => {
    expect(toPluginEnvVarName('my-custom-plugin', 'key')).toBe('FORGEPORTAL_PLUGIN_MY_CUSTOM_PLUGIN_KEY');
  });
});

describe('resolvePluginConfig', () => {
  afterEach(() => {
    delete process.env['FORGEPORTAL_PLUGIN_PD_APITOKEN'];
    delete process.env['FORGEPORTAL_PLUGIN_PD_ENDPOINT'];
  });

  it('returns yaml values for non-secret fields', () => {
    const { resolved, publicConfig } = resolvePluginConfig(
      'pd',
      { endpoint: 'https://pd.example.com' },
      { endpoint: { type: 'string', required: true } },
    );
    expect(resolved['endpoint']).toBe('https://pd.example.com');
    expect(publicConfig['endpoint']).toBe('https://pd.example.com');
  });

  it('sources secret from env var, excludes from publicConfig', () => {
    process.env['FORGEPORTAL_PLUGIN_PD_APITOKEN'] = 'secret-value';

    const { resolved, publicConfig, secretKeys } = resolvePluginConfig(
      'pd',
      {},
      { apiToken: { type: 'string', secret: true, required: true } },
    );

    expect(resolved['apiToken']).toBe('secret-value');
    expect(publicConfig['apiToken']).toBeUndefined();
    expect(secretKeys.has('apiToken')).toBe(true);
  });

  it('applies default from manifest for non-secret missing field', () => {
    const { resolved } = resolvePluginConfig(
      'pd',
      {},
      { timeout: { type: 'number', default: 30 } },
    );
    expect(resolved['timeout']).toBe(30);
  });

  it('yaml value takes precedence over manifest default', () => {
    const { resolved } = resolvePluginConfig(
      'pd',
      { timeout: 60 },
      { timeout: { type: 'number', default: 30 } },
    );
    expect(resolved['timeout']).toBe(60);
  });

  it('does NOT apply default for secret fields (security)', () => {
    const { resolved } = resolvePluginConfig(
      'pd',
      {},
      { apiToken: { type: 'string', secret: true, default: 'should-not-appear' } },
    );
    expect(resolved['apiToken']).toBeUndefined();
  });

  it('returns empty publicConfig and secretKeys when no manifest config', () => {
    const { resolved, publicConfig, secretKeys } = resolvePluginConfig('pd', { foo: 'bar' }, undefined);
    expect(resolved['foo']).toBe('bar');
    expect(publicConfig['foo']).toBe('bar');
    expect(secretKeys.size).toBe(0);
  });

  it('multiple secrets: all excluded from publicConfig', () => {
    process.env['FORGEPORTAL_PLUGIN_PD_APITOKEN'] = 'tok-abc';

    const { resolved, publicConfig } = resolvePluginConfig(
      'pd',
      { endpoint: 'https://pd.example.com' },
      {
        apiToken:  { type: 'string', secret: true, required: true },
        endpoint:  { type: 'string', required: true },
      },
    );

    expect(resolved['apiToken']).toBe('tok-abc');
    expect(resolved['endpoint']).toBe('https://pd.example.com');
    expect(publicConfig['apiToken']).toBeUndefined();
    expect(publicConfig['endpoint']).toBe('https://pd.example.com');
  });
});
