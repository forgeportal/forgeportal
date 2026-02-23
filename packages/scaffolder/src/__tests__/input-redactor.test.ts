import { describe, it, expect } from 'vitest';
import { redactActionInput } from '../input-redactor.js';

describe('redactActionInput', () => {
  const definition = {
    parameters: {
      type: 'object',
      properties: {
        repoName: { type: 'string' },
        token: { type: 'string', secret: true },
        private: { type: 'boolean' },
      },
    },
  };

  it('replaces field with secret:true with "***"', () => {
    const input = { repoName: 'my-repo', token: 'ghp_supersecret' };
    const result = redactActionInput(input, definition);
    expect(result['token']).toBe('***');
    expect(result['repoName']).toBe('my-repo');
  });

  it('leaves field with secret:false (or absent secret) unchanged', () => {
    const input = { repoName: 'my-repo', private: true };
    const result = redactActionInput(input, definition);
    expect(result['repoName']).toBe('my-repo');
    expect(result['private']).toBe(true);
  });

  it('leaves field not in properties unchanged', () => {
    const input = { repoName: 'my-repo', extraField: 'value' };
    const result = redactActionInput(input, definition);
    expect(result['extraField']).toBe('value');
  });

  it('returns input unchanged when definition has no parameters.properties', () => {
    const input = { token: 'supersecret' };
    const result = redactActionInput(input, {});
    expect(result).toEqual({ token: 'supersecret' });
  });

  it('redacts multiple secret fields', () => {
    const def = {
      parameters: {
        properties: {
          token: { type: 'string', secret: true },
          apiKey: { type: 'string', secret: true },
          name: { type: 'string' },
        },
      },
    };
    const input = { token: 'abc', apiKey: '123', name: 'test' };
    const result = redactActionInput(input, def);
    expect(result['token']).toBe('***');
    expect(result['apiKey']).toBe('***');
    expect(result['name']).toBe('test');
  });

  it('replaces non-string secret field (number) with "***"', () => {
    const def = {
      parameters: {
        properties: {
          pinCode: { type: 'number', secret: true },
        },
      },
    };
    const input = { pinCode: 1234 };
    const result = redactActionInput(input, def);
    expect(result['pinCode']).toBe('***');
  });
});
