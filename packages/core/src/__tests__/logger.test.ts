import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger } from '../logger.js';

function collectStream(): { chunks: string[]; dest: Writable } {
  const chunks: string[] = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { chunks, dest };
}

describe('createLogger', () => {
  it('outputs structured JSON', async () => {
    const { chunks, dest } = collectStream();
    const logger = createLogger({ destination: dest });
    logger.info('hello structured');
    await new Promise<void>((resolve) => dest.end(resolve));

    const parsed = JSON.parse(chunks[0]);
    expect(parsed).toHaveProperty('msg', 'hello structured');
    expect(parsed).toHaveProperty('level', 30);
  });

  it('creates a logger with specified name and level', () => {
    const logger = createLogger({ level: 'debug', name: 'test-svc' });
    expect(logger.level).toBe('debug');
  });

  it('defaults to info level', () => {
    const logger = createLogger();
    expect(logger.level).toBe('info');
  });

  it('redacts secrets in log messages via hooks', async () => {
    const { chunks, dest } = collectStream();
    const logger = createLogger({ destination: dest });

    const token = 'ghp_' + 'a'.repeat(36);
    logger.info(`secret: ${token}`);

    await new Promise<void>((resolve) => dest.end(resolve));

    const output = chunks.join('');
    expect(output).toContain('[REDACTED:github-pat]');
    expect(output).not.toContain(token);
  });

  it('debug not shown at info level', async () => {
    const { chunks, dest } = collectStream();
    const logger = createLogger({ destination: dest });
    logger.debug('should not appear');
    logger.info('should appear');
    await new Promise<void>((resolve) => dest.end(resolve));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('should appear');
  });
});
