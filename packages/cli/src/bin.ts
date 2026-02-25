#!/usr/bin/env node
/**
 * forge — ForgePortal CLI
 *
 * Usage:
 *   forge sync                 # sync plugin deps + pnpm install
 *   forge sync --dry-run       # show diff, no writes
 *   forge sync --ci            # write only, no pnpm install (Dockerfile use)
 *   forge sync --check         # exit 1 if out of sync (CI gate)
 */
import { syncCommand } from './commands/sync.js';

const args    = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(`
forge — ForgePortal CLI

Commands:
  sync              Sync plugin dependencies from forgeportal.yaml → package.json files
  sync --dry-run    Show changes without writing any files
  sync --check      Exit 1 if package.json files are out of sync (CI gate)
  sync --ci         Write files without running pnpm install (for Dockerfile)
`);
  process.exit(0);
}

if (command === 'sync') {
  const dryRun     = args.includes('--dry-run');
  const ci         = args.includes('--ci');
  const check      = args.includes('--check');
  const configFlag = args.indexOf('--config');
  const configPath = configFlag !== -1 ? args[configFlag + 1] : undefined;

  syncCommand({ dryRun, ci, check, configPath }).catch((err: unknown) => {
    console.error('forge sync failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else {
  console.error(`Unknown command: "${command}". Run "forge --help" for usage.`);
  process.exit(1);
}
