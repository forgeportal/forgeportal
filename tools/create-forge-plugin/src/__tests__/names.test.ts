import { describe, it, expect } from 'vitest';
import { deriveNames } from '../names.js';

describe('deriveNames', () => {
  it('single-segment name without org', () => {
    const n = deriveNames('pagerduty');
    expect(n.pluginId).toBe('pagerduty');
    expect(n.packageName).toBe('forge-plugin-pagerduty');
    expect(n.dirName).toBe('forge-plugin-pagerduty');
    expect(n.pascalName).toBe('Pagerduty');
    expect(n.camelName).toBe('pagerduty');
    expect(n.title).toBe('Pagerduty');
    expect(n.org).toBeUndefined();
  });

  it('multi-segment name with org', () => {
    const n = deriveNames('my-custom-plugin', '@acme');
    expect(n.pluginId).toBe('my-custom-plugin');
    expect(n.packageName).toBe('@acme/forge-plugin-my-custom-plugin');
    expect(n.dirName).toBe('forge-plugin-my-custom-plugin');
    expect(n.pascalName).toBe('MyCustomPlugin');
    expect(n.camelName).toBe('myCustomPlugin');
    expect(n.title).toBe('My Custom Plugin');
    expect(n.org).toBe('@acme');
  });

  it('two-segment name', () => {
    const n = deriveNames('slack-notify');
    expect(n.pascalName).toBe('SlackNotify');
    expect(n.camelName).toBe('slackNotify');
    expect(n.title).toBe('Slack Notify');
  });

  it('single char segments', () => {
    const n = deriveNames('a-b-c');
    expect(n.pascalName).toBe('ABC');
    expect(n.camelName).toBe('aBC');
  });

  it('throws on uppercase in name', () => {
    expect(() => deriveNames('MyPlugin')).toThrow('Invalid plugin ID');
  });

  it('throws on leading hyphen', () => {
    expect(() => deriveNames('-bad')).toThrow('Invalid plugin ID');
  });

  it('throws on invalid org (no @)', () => {
    expect(() => deriveNames('plugin', 'myorg')).toThrow('Invalid org scope');
  });

  it('throws on org with uppercase', () => {
    expect(() => deriveNames('plugin', '@MyOrg')).toThrow('Invalid org scope');
  });
});
