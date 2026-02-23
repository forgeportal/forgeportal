import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { loadConfig } from '../config.loader.js';

function withTempYaml(content: string, fn: (path: string) => void): void {
  const tmpPath = `test-config-${Date.now()}.yaml`;
  fs.writeFileSync(tmpPath, content, 'utf-8');
  try {
    fn(tmpPath);
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

const CLEAN_ENV: Record<string, string | undefined> = {};

describe('loadConfig', () => {
  it('parses valid YAML file and returns typed config', () => {
    withTempYaml(
      `
db:
  host: myhost
  port: 5433
server:
  logLevel: debug
`,
      (path) => {
        const config = loadConfig(path, CLEAN_ENV);
        expect(config.db.host).toBe('myhost');
        expect(config.db.port).toBe(5433);
        expect(config.server.logLevel).toBe('debug');
        expect(config.db.database).toBe('forgeportal');
      },
    );
  });

  it('missing YAML file uses defaults, no error', () => {
    const config = loadConfig('nonexistent.yaml', CLEAN_ENV);
    expect(config.db.host).toBe('localhost');
    expect(config.db.port).toBe(5432);
    expect(config.server.port).toBe(4000);
    expect(config.migrations.runSeed).toBe(false);
  });

  it('invalid YAML causes process.exit(1)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    withTempYaml(
      `
db:
  port: not-a-number
`,
      (path) => {
        expect(() => loadConfig(path, CLEAN_ENV)).toThrow('process.exit called');
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorSpy).toHaveBeenCalled();
        const msg = errorSpy.mock.calls[0][0] as string;
        expect(msg).toContain('Invalid ForgePortal configuration');
      },
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('FORGEPORTAL_DB__HOST env var overrides config', () => {
    const config = loadConfig('nonexistent.yaml', {
      FORGEPORTAL_DB__HOST: 'override-host',
    });
    expect(config.db.host).toBe('override-host');
  });

  it('legacy env var DB_HOST sets config.db.host', () => {
    const config = loadConfig('nonexistent.yaml', {
      DB_HOST: 'legacy-host',
    });
    expect(config.db.host).toBe('legacy-host');
  });

  it('FORGEPORTAL_* takes priority over legacy env var', () => {
    const config = loadConfig('nonexistent.yaml', {
      DB_HOST: 'legacy-host',
      FORGEPORTAL_DB__HOST: 'forgeportal-host',
    });
    expect(config.db.host).toBe('forgeportal-host');
  });

  it('boolean coercion: FORGEPORTAL_MIGRATIONS__RUN_SEED=true', () => {
    const config = loadConfig('nonexistent.yaml', {
      FORGEPORTAL_MIGRATIONS__RUN_SEED: 'true',
    });
    expect(config.migrations.runSeed).toBe(true);
  });

  it('number coercion: FORGEPORTAL_DB__PORT=5433', () => {
    const config = loadConfig('nonexistent.yaml', {
      FORGEPORTAL_DB__PORT: '5433',
    });
    expect(config.db.port).toBe(5433);
  });

  it('malformed YAML syntax causes process.exit(1)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    withTempYaml('db:\n  host: [unclosed', (path) => {
      expect(() => loadConfig(path, CLEAN_ENV)).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
      const msg = errorSpy.mock.calls[0][0] as string;
      expect(msg).toContain('Failed to parse');
    });

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('env var overrides YAML value', () => {
    withTempYaml(
      `
db:
  host: yaml-host
`,
      (path) => {
        const config = loadConfig(path, {
          FORGEPORTAL_DB__HOST: 'env-host',
        });
        expect(config.db.host).toBe('env-host');
      },
    );
  });
});
