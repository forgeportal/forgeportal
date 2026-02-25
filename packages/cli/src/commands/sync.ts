import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncOptions {
  dryRun?:    boolean;
  ci?:        boolean;
  check?:     boolean;
  configPath?: string;
  /** Override the monorepo root (useful for tests). Defaults to process.cwd(). */
  root?:      string;
}

export interface SyncResult {
  apiAdded:   string[];
  apiRemoved: string[];
  uiAdded:    string[];
  uiRemoved:  string[];
  changed:    boolean;
}

interface ForgePortalConfig {
  pluginPackages?: { packages?: string[] };
}

interface PackageJson {
  dependencies?: Record<string, string>;
  [key: string]: unknown;
}

interface PluginInfo {
  packageName: string;
  version:     string;
  pluginType:  'ui' | 'backend' | 'fullstack';
}

// ─── Main command ─────────────────────────────────────────────────────────────

/**
 * `forge sync` — synchronises plugin dependencies from forgeportal.yaml
 * into apps/api/package.json and apps/ui/package.json.
 *
 * Modes:
 *   default    write + pnpm install
 *   --dry-run  print diff, no writes
 *   --check    exit 1 if out of sync (CI gate)
 *   --ci       write files, skip pnpm install (Dockerfile use)
 */
export async function syncCommand(opts: SyncOptions = {}): Promise<SyncResult> {
  const root      = opts.root ?? process.cwd();
  const cfgPath   = opts.configPath ?? path.join(root, 'forgeportal.yaml');

  // ── 1. Read forgeportal.yaml ──────────────────────────────────────────────

  if (!fs.existsSync(cfgPath)) {
    if (opts.ci) {
      console.log('[forge sync] No forgeportal.yaml found — nothing to sync.');
      return emptyResult();
    }
    console.warn(`[forge sync] Warning: ${cfgPath} not found. Nothing to sync.`);
    return emptyResult();
  }

  const config   = yaml.load(fs.readFileSync(cfgPath, 'utf8')) as ForgePortalConfig;
  const packages = config.pluginPackages?.packages ?? [];

  // ── 2. Resolve manifests ──────────────────────────────────────────────────

  if (packages.length === 0) {
    console.log('[forge sync] No plugins configured — will remove any installed forge plugins.');
  }

  const resolved: PluginInfo[] = [];
  for (const pkg of packages) {
    try {
      const info = await resolveManifest(pkg, root);
      resolved.push(info);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (opts.ci) {
        console.error(`[forge sync] ERROR: Cannot resolve manifest for "${pkg}": ${msg}`);
        process.exit(1);
      }
      console.warn(`[forge sync] Warning: Cannot resolve manifest for "${pkg}": ${msg}. Skipping.`);
    }
  }

  // ── 3. Build desired dep maps ─────────────────────────────────────────────

  const apiDeps: Record<string, string> = {};
  const uiDeps:  Record<string, string> = {};

  for (const { packageName, version, pluginType } of resolved) {
    const versionSpec = version.startsWith('workspace:') ? version : `^${version}`;
    if (pluginType === 'backend'  || pluginType === 'fullstack') apiDeps[packageName] = versionSpec;
    if (pluginType === 'ui'       || pluginType === 'fullstack') uiDeps[packageName]  = versionSpec;
  }

  // ── 4. Apply to package.json files ────────────────────────────────────────

  const apiPkgPath = path.join(root, 'apps', 'api', 'package.json');
  const uiPkgPath  = path.join(root, 'apps', 'ui',  'package.json');

  const apiDiff = computeDiff(apiPkgPath, apiDeps);
  const uiDiff  = computeDiff(uiPkgPath,  uiDeps);
  const changed = apiDiff.changed || uiDiff.changed;

  // ── 5. Handle modes ───────────────────────────────────────────────────────

  if (opts.check) {
    if (changed) {
      console.error(
        '✗  package.json files are out of sync with forgeportal.yaml.\n' +
        '   Run "pnpm forge:sync" to fix.\n',
      );
      printDiff(apiPkgPath, apiDiff);
      printDiff(uiPkgPath,  uiDiff);
      process.exit(1);
    }
    console.log('✓  package.json files are in sync with forgeportal.yaml.');
    return toResult(apiDiff, uiDiff);
  }

  if (opts.dryRun) {
    console.log('[forge sync --dry-run] Changes that would be applied:\n');
    printDiff(apiPkgPath, apiDiff);
    printDiff(uiPkgPath,  uiDiff);
    if (!changed) console.log('  (no changes needed)');
    return toResult(apiDiff, uiDiff);
  }

  if (!changed) {
    console.log('✓  package.json files already in sync — nothing to do.');
    return emptyResult();
  }

  // Write files
  applyDiff(apiPkgPath, apiDiff);
  applyDiff(uiPkgPath,  uiDiff);

  const totalAdded   = apiDiff.toAdd.length   + uiDiff.toAdd.length;
  const totalRemoved = apiDiff.toRemove.length + uiDiff.toRemove.length;
  console.log(
    `✓  Synced: +${totalAdded} dep(s) added, -${totalRemoved} dep(s) removed across api/ui.`,
  );

  // ── 6. pnpm install (skip in --ci) ────────────────────────────────────────

  if (!opts.ci) {
    console.log('   Running pnpm install…');
    execSync('pnpm install', { stdio: 'inherit', cwd: root });
    console.log('✓  pnpm install complete.');
  }

  return toResult(apiDiff, uiDiff);
}

// ─── Manifest resolution ──────────────────────────────────────────────────────

/**
 * Resolves a plugin's type and version from:
 *   1. Local workspace package (packages/plugin-<name>/forgeportal-plugin.json)
 *   2. node_modules/<pkg>/forgeportal-plugin.json  (installed package or workspace symlink)
 *   3. npm registry via `npm view`
 */
async function resolveManifest(packageName: string, root: string): Promise<PluginInfo> {
  // ── Try via require.resolve (covers both node_modules and workspace symlinks) ──
  try {
    const req      = createRequire(path.join(root, '_placeholder_.js'));
    const pkgDir   = path.dirname(req.resolve(`${packageName}/package.json`));
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pkgDir, 'forgeportal-plugin.json'), 'utf8'),
    ) as { version: string; forgeportal: { type: string } };

    return {
      packageName,
      version:    manifest.version,
      pluginType: manifest.forgeportal.type as PluginInfo['pluginType'],
    };
  } catch {
    // not in node_modules — try workspace packages directory directly
  }

  // ── Try workspace scan: packages/*/forgeportal-plugin.json ──
  const pkgsDir = path.join(root, 'packages');
  if (fs.existsSync(pkgsDir)) {
    for (const dir of fs.readdirSync(pkgsDir)) {
      const pkgJsonPath  = path.join(pkgsDir, dir, 'package.json');
      const manifestPath = path.join(pkgsDir, dir, 'forgeportal-plugin.json');
      if (!fs.existsSync(pkgJsonPath) || !fs.existsSync(manifestPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as { name?: string };
      if (pkg.name !== packageName) continue;
      const manifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf8'),
      ) as { version: string; forgeportal: { type: string } };
      return {
        packageName,
        version:    'workspace:*',
        pluginType: manifest.forgeportal.type as PluginInfo['pluginType'],
      };
    }
  }

  // ── Fall back to npm registry ──────────────────────────────────────────────
  try {
    const raw  = execSync(
      `npm view ${packageName} version --json 2>/dev/null`,
      { encoding: 'utf8', timeout: 15_000 },
    ).trim();
    const version = JSON.parse(raw) as string;

    // Fetch forgeportal field to determine type
    const meta = execSync(
      `npm view ${packageName} forgeportal --json 2>/dev/null`,
      { encoding: 'utf8', timeout: 15_000 },
    ).trim();
    const forgeportal = JSON.parse(meta) as { type?: string } | null;
    const pluginType  = (forgeportal?.type ?? 'backend') as PluginInfo['pluginType'];

    return { packageName, version, pluginType };
  } catch {
    throw new Error(
      `Plugin "${packageName}" not found in node_modules, workspace packages, or npm registry.`,
    );
  }
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

interface Diff {
  changed:  boolean;
  toAdd:    Array<[string, string]>; // [name, version]
  toRemove: string[];
}

/**
 * Computes the diff between current deps in package.json and desired deps.
 * Also removes plugin deps that are no longer configured.
 */
function computeDiff(pkgPath: string, desiredDeps: Record<string, string>): Diff {
  if (!fs.existsSync(pkgPath)) {
    return { changed: false, toAdd: [], toRemove: [] };
  }

  const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;
  const current = pkg.dependencies ?? {};

  const toRemove = Object.keys(current).filter(
    (dep) => isPluginPackage(dep) && !(dep in desiredDeps),
  );
  const toAdd = Object.entries(desiredDeps).filter(
    ([dep, ver]) => current[dep] !== ver,
  );

  return {
    changed:  toRemove.length > 0 || toAdd.length > 0,
    toAdd,
    toRemove,
  };
}

function applyDiff(pkgPath: string, diff: Diff): void {
  if (!diff.changed || !fs.existsSync(pkgPath)) return;

  const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;
  const current = pkg.dependencies ?? {};

  for (const dep of diff.toRemove) delete current[dep];
  for (const [dep, ver] of diff.toAdd) current[dep] = ver;

  pkg.dependencies = sortKeys(current);
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  const label = path.relative(process.cwd(), pkgPath);
  console.log(`  ✓ ${label}: +${diff.toAdd.length} -${diff.toRemove.length}`);
}

function printDiff(pkgPath: string, diff: Diff): void {
  if (!diff.changed) return;
  const label = path.relative(process.cwd(), pkgPath);
  console.log(`  ${label}:`);
  for (const [dep, ver] of diff.toAdd)    console.log(`    + ${dep}@${ver}`);
  for (const dep of diff.toRemove)         console.log(`    - ${dep}`);
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Returns true if the package is a user-installable ForgePortal plugin
 * managed by `forge sync`. Excludes framework packages like @forgeportal/plugin-sdk.
 */
function isPluginPackage(name: string): boolean {
  // plugin-sdk is a framework/SDK package — never remove it automatically.
  if (name === '@forgeportal/plugin-sdk') return false;
  return name.startsWith('@forgeportal/plugin-') || /^forge-plugin-/.test(name) || /^@[^/]+\/forge-plugin-/.test(name);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyResult(): SyncResult {
  return { apiAdded: [], apiRemoved: [], uiAdded: [], uiRemoved: [], changed: false };
}

function toResult(apiDiff: Diff, uiDiff: Diff): SyncResult {
  return {
    apiAdded:   apiDiff.toAdd.map(([d]) => d),
    apiRemoved: apiDiff.toRemove,
    uiAdded:    uiDiff.toAdd.map(([d]) => d),
    uiRemoved:  uiDiff.toRemove,
    changed:    apiDiff.changed || uiDiff.changed,
  };
}
