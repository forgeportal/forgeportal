import fs from 'node:fs';
import yaml from 'js-yaml';
import { type ZodError } from 'zod';
import { appConfigSchema, type AppConfig } from './config.schema.js';

const FORGEPORTAL_PREFIX = 'FORGEPORTAL_';
const NESTING_SEP = '__';

const LEGACY_ENV_MAP: Record<string, string[]> = {
  DB_HOST: ['db', 'host'],
  DB_PORT: ['db', 'port'],
  DB_NAME: ['db', 'database'],
  DB_USER: ['db', 'user'],
  DB_PASSWORD: ['db', 'password'],
  PORT: ['server', 'port'],
  LOG_LEVEL: ['server', 'logLevel'],
  OIDC_ISSUER: ['auth', 'oidc', 'issuer'],
  OIDC_CLIENT_ID: ['auth', 'oidc', 'clientId'],
  OIDC_CLIENT_SECRET: ['auth', 'oidc', 'clientSecret'],
  OIDC_REDIRECT_URI: ['auth', 'oidc', 'redirectUri'],
  OIDC_SCOPES: ['auth', 'oidc', 'scopes'],
  OIDC_GROUPS_CLAIM: ['auth', 'oidc', 'groupsClaim'],
  SESSION_SECRET: ['auth', 'sessionSecret'],
  ENCRYPTION_KEY: ['encryptionKey'],
  MIGRATIONS_DIR: ['migrations', 'dir'],
  RUN_SEED: ['migrations', 'runSeed'],
  SEED_FILE: ['migrations', 'seedFile'],
};

function snakeToCamel(s: string): string {
  const parts = s.toLowerCase().split('_');
  return parts
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
}

function coerceValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function setNested(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

function applyLegacyEnvVars(
  config: Record<string, unknown>,
  env: Record<string, string | undefined>,
): void {
  for (const [envKey, configPath] of Object.entries(LEGACY_ENV_MAP)) {
    const value = env[envKey];
    if (value !== undefined) {
      setNested(config, configPath, coerceValue(value));
    }
  }
}

function applyForgeportalEnvVars(
  config: Record<string, unknown>,
  env: Record<string, string | undefined>,
): void {
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(FORGEPORTAL_PREFIX) || value === undefined) continue;

    const stripped = key.slice(FORGEPORTAL_PREFIX.length);
    const segments = stripped.split(NESTING_SEP).map(snakeToCamel);

    setNested(config, segments, coerceValue(value));
  }
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
}

export function loadConfig(
  yamlPath?: string,
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const filePath = yamlPath ?? 'forgeportal.yaml';
  let raw: Record<string, unknown> = {};

  if (fs.existsSync(filePath)) {
    const contents = fs.readFileSync(filePath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = yaml.load(contents);
    } catch (err) {
      console.error(`Failed to parse ${filePath}:\n  ${String(err)}`);
      process.exit(1);
    }
    if (parsed && typeof parsed === 'object') {
      raw = parsed as Record<string, unknown>;
    }
  }

  applyLegacyEnvVars(raw, env);
  applyForgeportalEnvVars(raw, env);

  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error('Invalid ForgePortal configuration:\n' + formatZodError(result.error));
    process.exit(1);
  }

  return result.data;
}
