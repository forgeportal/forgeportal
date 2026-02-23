import { describe, it, expect } from 'vitest';
import { validatePluginConfig } from '../plugin-config-validator.js';

describe('validatePluginConfig', () => {
  it('valid config — all required fields present', () => {
    const result = validatePluginConfig(
      'pd',
      { apiEndpoint: 'https://pd.example.com' },
      { apiEndpoint: { type: 'string', required: true } },
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('missing required non-secret field → error', () => {
    const result = validatePluginConfig(
      'pd',
      {},
      { apiEndpoint: { type: 'string', required: true } },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('"apiEndpoint"');
    expect(result.errors[0]).toContain('plugins.pd.config.apiEndpoint');
  });

  it('missing required secret field → error with env var name', () => {
    const result = validatePluginConfig(
      'pd',
      {},
      { apiToken: { type: 'string', secret: true, required: true } },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('FORGEPORTAL_PLUGIN_PD_APITOKEN');
  });

  it('required secret present via resolved config → valid', () => {
    // resolvePluginConfig already merged the env var value before validation
    const result = validatePluginConfig(
      'pd',
      { apiToken: 'from-env' },
      { apiToken: { type: 'string', secret: true, required: true } },
    );
    expect(result.valid).toBe(true);
  });

  it('wrong type → warning, not error', () => {
    const result = validatePluginConfig(
      'pd',
      { timeout: 'thirty' },     // string, but manifest says number
      { timeout: { type: 'number' } },
    );
    expect(result.valid).toBe(true); // non-fatal
    expect(result.warnings[0]).toContain('"timeout"');
    expect(result.warnings[0]).toContain('"number"');
    expect(result.warnings[0]).toContain('"string"');
  });

  it('unknown config key → warning', () => {
    const result = validatePluginConfig(
      'pd',
      { unknownKey: 'value' },
      { endpoint: { type: 'string' } },
    );
    expect(result.warnings[0]).toContain('"unknownKey"');
  });

  it('no manifest config → always valid, no warnings', () => {
    const result = validatePluginConfig('pd', { anything: 'goes' }, undefined);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('empty manifest config → always valid', () => {
    const result = validatePluginConfig('pd', { anything: 'goes' }, {});
    expect(result.valid).toBe(true);
  });

  it('optional field absent → valid', () => {
    const result = validatePluginConfig(
      'pd',
      {},
      { optionalField: { type: 'string', required: false } },
    );
    expect(result.valid).toBe(true);
  });

  it('empty string treated as missing for required field', () => {
    const result = validatePluginConfig(
      'pd',
      { apiEndpoint: '' },
      { apiEndpoint: { type: 'string', required: true } },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('"apiEndpoint"');
  });

  it('multiple errors accumulated', () => {
    const result = validatePluginConfig(
      'pd',
      {},
      {
        field1: { type: 'string', required: true },
        field2: { type: 'string', required: true },
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});
