import { describe, it, expect } from 'vitest';
import { mapScmError } from '../../../actions/scm/scm-error-mapper.js';
import { ActionError } from '../../../types.js';

function httpErr(status: number, message = 'oops'): unknown {
  return { status, message };
}

describe('mapScmError', () => {
  it('401 → AUTH_ERROR', () => {
    const err = mapScmError(httpErr(401, 'Unauthorized'), 'op');
    expect(err).toBeInstanceOf(ActionError);
    expect(err.code).toBe('AUTH_ERROR');
  });

  it('403 → AUTH_ERROR', () => {
    const err = mapScmError(httpErr(403, 'Forbidden'), 'op');
    expect(err.code).toBe('AUTH_ERROR');
  });

  it('404 → NOT_FOUND', () => {
    const err = mapScmError(httpErr(404), 'op');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('409 → CONFLICT', () => {
    const err = mapScmError(httpErr(409), 'op');
    expect(err.code).toBe('CONFLICT');
  });

  it('422 → CONFLICT', () => {
    const err = mapScmError(httpErr(422), 'op');
    expect(err.code).toBe('CONFLICT');
  });

  it('429 → RATE_LIMITED', () => {
    const err = mapScmError(httpErr(429), 'op');
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('503 → REMOTE_ERROR', () => {
    const err = mapScmError(httpErr(503), 'op');
    expect(err.code).toBe('REMOTE_ERROR');
  });

  it('unknown error (no status) → INTERNAL_ERROR', () => {
    const err = mapScmError(new Error('unexpected'), 'op');
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});
