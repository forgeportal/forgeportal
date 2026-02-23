import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  renderObjectDeep,
  buildStepContext,
} from '../template-engine.js';

describe('renderTemplate', () => {
  it('AC1 — interpolates a simple variable', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'World' })).toBe('Hello World');
  });

  it('AC2 — resolves nested step output context', () => {
    const context = buildStepContext(
      { provider: 'github' },
      { 'create-repo': { outputs: { repoUrl: 'https://github.com/acme/svc' } } },
    );
    expect(renderTemplate('{{steps.create-repo.outputs.repoUrl}}', context))
      .toBe('https://github.com/acme/svc');
  });

  it('AC1 — evaluates eq helper in if block', () => {
    const result = renderTemplate(
      '{{#if (eq provider "github")}}github-actions{{else}}gitlab-ci{{/if}}',
      { provider: 'github' },
    );
    expect(result).toBe('github-actions');
  });

  it('AC1 — missing variable renders as empty string (strict: false)', () => {
    expect(renderTemplate('{{missing}}', {})).toBe('');
  });

  it('AC6 — angle brackets are NOT escaped (noEscape: true)', () => {
    expect(renderTemplate('{{val}}', { val: '<tag>' })).toBe('<tag>');
  });
});

describe('renderObjectDeep', () => {
  it('AC1 — recurses into nested objects', () => {
    const result = renderObjectDeep(
      { a: '{{x}}', b: { c: '{{y}}' } },
      { x: '1', y: '2' },
    );
    expect(result).toEqual({ a: '1', b: { c: '2' } });
  });

  it('AC1 — recurses into arrays', () => {
    const result = renderObjectDeep(['{{a}}', '{{b}}'], { a: 'hello', b: 'world' });
    expect(result).toEqual(['hello', 'world']);
  });

  it('AC1 — numbers, booleans and null pass through unchanged', () => {
    expect(renderObjectDeep(42, {})).toBe(42);
    expect(renderObjectDeep(true, {})).toBe(true);
    expect(renderObjectDeep(null, {})).toBeNull();
  });
});

describe('buildStepContext', () => {
  it('AC2 — merges user inputs and step outputs under steps.*', () => {
    const ctx = buildStepContext(
      { name: 'svc', provider: 'github' },
      { 'create-repo': { outputs: { repoUrl: 'https://github.com/org/svc' } } },
    );
    expect(ctx['name']).toBe('svc');
    expect((ctx['steps'] as Record<string, unknown>)['create-repo']).toEqual({
      outputs: { repoUrl: 'https://github.com/org/svc' },
    });
  });
});
