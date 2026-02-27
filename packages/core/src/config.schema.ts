import { z } from 'zod';

export const dbConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.coerce.number().default(5432),
  database: z.string().default('forgeportal'),
  user: z.string().default('forge'),
  password: z.string().default('forge_local_dev'),
  maxPoolSize: z.coerce.number().default(20),
});

export const serverConfigSchema = z.object({
  port: z.coerce.number().default(4000),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Optional security headers override. If set, CSP can be customized or disabled (empty string). */
  securityHeaders: z
    .object({
      csp: z.string().optional(),
    })
    .optional(),
});

export const roleMappingSchema = z
  .record(
    z.enum(['platform-admin', 'template-admin', 'team-admin', 'developer', 'viewer']),
    z.array(z.string()),
  )
  .optional();

export const authConfigSchema = z.object({
  oidc: z
    .object({
      /** Discovery endpoint base URL of your OIDC provider. Works with any OIDC-compliant IDP. */
      issuer: z.string().url().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      /**
       * Override the redirect URI sent to the OIDC provider.
       * Defaults to http(s)://<host>:<port>/api/v1/auth/callback.
       * When running behind a proxy or Vite dev server, set this to the browser-accessible URL.
       * Example: http://localhost:3000/api/v1/auth/callback
       */
      redirectUri: z.string().url().optional(),
      /**
       * Space-separated OIDC scopes.
       * Default: "openid email profile"
       * Add "groups" for Keycloak/Okta, "offline_access" for refresh tokens, etc.
       */
      scopes: z.string().default('openid email profile'),
      /**
       * JWT claim that contains the user's groups or roles.
       * Default: tries "groups", "roles", "realm_access.roles" in order (covers most IDPs).
       * Override with e.g. "cognito:groups" (AWS Cognito) or "roles" (Azure AD app roles).
       */
      groupsClaim: z.string().optional(),
    })
    .default({}),
  /**
   * Map IDP group/role names → ForgePortal roles.
   * Allows any IDP naming convention to be translated without code changes.
   *
   * Example (forgeportal.yaml):
   *   auth:
   *     roleMapping:
   *       platform-admin: ["forge-admins", "platform-admins"]
   *       developer:       ["engineers", "devs"]
   *       viewer:          ["everyone", "all-staff"]
   *
   * If not set, ForgePortal expects the IDP to return group names that exactly
   * match the role names: "platform-admin", "developer", "viewer", etc.
   */
  roleMapping: roleMappingSchema,
  sessionSecret: z
    .string()
    .min(16)
    .default('change-me-forgeportal-session-secret'),
});

export const scmConfigSchema = z.object({
  // z.preprocess coerces null → {} so YAML `github:` (parsed as null) is valid.
  github: z.preprocess(
    (v) => (v == null ? {} : v),
    z.object({
      appId: z.string().optional(),
      privateKeyPath: z.string().optional(),
      token: z.string().optional(),
      webhookSecret: z.string().optional(),
    }),
  ).default({}),
  gitlab: z.preprocess(
    (v) => (v == null ? {} : v),
    z.object({
      token: z.string().optional(),
      baseUrl: z.string().url().default('https://gitlab.com'),
      webhookSecret: z.string().optional(),
    }),
  ).default({}),
});

export const migrationsConfigSchema = z.object({
  dir: z.string().default('tools/migration'),
  runSeed: z.coerce.boolean().default(false),
  seedFile: z.string().default('tools/seed/seed_v1.sql'),
});

export const docsConfigSchema = z.object({
  /** Max size in bytes for a single file to be indexed (default 5 MB). Larger files are skipped. */
  maxIndexFileSizeBytes: z.coerce.number().int().min(0).default(5 * 1024 * 1024),
}).default({});

export const discoveryConfigSchema = z.object({
  orgs: z
    .array(
      z.object({
        provider: z.enum(['github', 'gitlab']),
        org: z.string(),
        topic: z.string().optional(),
      }),
    )
    .default([]),
  entityFilePath: z.string().default('entity.yaml'),
  intervalMinutes: z.coerce.number().min(0).default(0),
});

export const pluginEntrySchema = z.object({
  enabled: z.coerce.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

export const scorecardsConfigSchema = z.object({
  /**
   * Interval in hours between nightly bulk scorecard evaluations.
   * Set to 0 to disable the scheduled sweep (useful in test/CI environments).
   */
  evalIntervalHours: z.number().int().min(0).default(24),
}).default({});

export const pluginPackagesSchema = z.object({
  /**
   * List of npm package names to load as plugins at startup.
   * Each package must have a valid forgeportal-plugin.json manifest.
   * Example: ["@myorg/forge-plugin-pagerduty", "@myorg/forge-plugin-costview"]
   */
  packages: z.array(z.string()).default([]),
}).default({});

const navLinkSchema = z.object({
  label: z.string().min(1).max(40),
  url:   z.string().url(),
  icon:  z.string().max(8).optional(),
});

export const uiBrandingSchema = z.object({
  portalName:   z.string().min(1).max(80).optional().default('ForgePortal'),
  logoUrl:      z.string().url().optional(),
  faviconUrl:   z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  navLinks:     z.array(navLinkSchema).max(10).optional().default([]),
}).optional().default({});

export const appConfigSchema = z.object({
  db: dbConfigSchema.default({}),
  server: serverConfigSchema.default({}),
  auth: authConfigSchema.default({}),
  scm: scmConfigSchema.default({}),
  discovery: discoveryConfigSchema.default({}),
  migrations: migrationsConfigSchema.default({}),
  docs: docsConfigSchema,
  plugins: z.record(pluginEntrySchema).default({}),
  pluginPackages: pluginPackagesSchema,
  scorecards: scorecardsConfigSchema,
  ui: uiBrandingSchema,
  encryptionKey: z
    .string()
    .min(16)
    .default('local-dev-key-change-in-prod-32chars!'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type DbConfig = z.infer<typeof dbConfigSchema>;
