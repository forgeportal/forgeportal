#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import {
  intro, outro, text, select, note, spinner,
  isCancel, cancel,
} from '@clack/prompts';
import { parseArgs } from './args.js';
import { deriveNames, type PluginType } from './names.js';
import { scaffoldPlugin } from './scaffolder.js';
import type { PluginNames } from './names.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  intro('⚡ create-forge-plugin — ForgePortal Plugin Scaffolder');

  // ── Collect plugin name ───────────────────────────────────────────────────

  let pluginId: string;

  if (args.name) {
    pluginId = args.name;
  } else {
    const result = await text({
      message:     'Plugin ID (short kebab-case name):',
      placeholder: 'pagerduty',
      validate(value) {
        if (!value) return 'Plugin ID is required.';
        if (!/^[a-z][a-z0-9-]*$/.test(value)) {
          return 'Must be lowercase kebab-case (letters, numbers, hyphens). e.g. "my-plugin"';
        }
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    pluginId = result;
  }

  // ── Collect plugin type ───────────────────────────────────────────────────

  let type: PluginType;

  if (args.type) {
    type = args.type;
  } else {
    const result = await select<PluginType>({
      message: 'Plugin type:',
      options: [
        {
          value: 'ui' as PluginType,
          label: 'UI only',
          hint:  'Entity tabs, entity cards, top-level routes (React components)',
        },
        {
          value: 'backend' as PluginType,
          label: 'Backend only',
          hint:  'Fastify routes, action providers, catalog providers',
        },
        {
          value: 'fullstack' as PluginType,
          label: 'Fullstack',
          hint:  'Both UI components and backend capabilities in one package',
        },
      ],
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    type = result;
  }

  // ── Collect org scope (optional) ──────────────────────────────────────────

  let org: string | undefined;

  if (args.org) {
    org = args.org;
  } else if (!args.yes) {
    const result = await text({
      message:     'npm scope (optional):',
      placeholder: '@myorg',
      validate(value) {
        if (!value) return; // optional
        if (!value.startsWith('@')) return 'Scope must start with @, e.g. "@myorg"';
        if (!/^@[a-z][a-z0-9-]*$/.test(value)) return 'Scope must be lowercase, e.g. "@myorg"';
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    org = (result as string) || undefined;
  }

  // ── Derive all names ──────────────────────────────────────────────────────

  let names: PluginNames;
  try {
    names = deriveNames(pluginId, org);
  } catch (err) {
    cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const parentDir = args.outDir ? path.resolve(args.outDir) : process.cwd();

  // ── Preview before writing ────────────────────────────────────────────────

  note(
    [
      `Package:   ${names.packageName}`,
      `Type:      ${type}`,
      `Directory: ${path.join(parentDir, names.dirName)}`,
    ].join('\n'),
    'Plugin summary',
  );

  // ── Scaffold files ────────────────────────────────────────────────────────

  const s = spinner();
  s.start('Generating plugin files\u2026');

  let result;
  try {
    result = await scaffoldPlugin(names, type, parentDir);
  } catch (err) {
    s.stop('Failed.');
    cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  s.stop(`Created ${result.filesCreated.length} files.`);

  // ── List generated files ──────────────────────────────────────────────────

  note(
    result.filesCreated.map((f) => `  ${f}`).join('\n'),
    'Files created',
  );

  // ── Next steps ────────────────────────────────────────────────────────────

  const steps = buildNextSteps(names, type, result.targetDir);
  note(steps, 'Next steps');

  outro(`Plugin "${names.pluginId}" scaffolded successfully!`);
}

function buildNextSteps(names: PluginNames, type: PluginType, targetDir: string): string {
  const relDir = path.relative(process.cwd(), targetDir) || names.dirName;
  const lines: string[] = [];

  lines.push(`1. Install dependencies:`);
  lines.push(`   cd ${relDir}`);
  lines.push(`   pnpm install`);
  lines.push('');
  lines.push(`2. Build:`);
  lines.push(`   pnpm build`);
  lines.push('');
  lines.push(`3. Install in the ForgePortal monorepo:`);
  lines.push(`   cd <path-to-forgeportal>`);
  lines.push(`   pnpm add ${names.packageName}`);
  lines.push('');

  if (type === 'ui' || type === 'fullstack') {
    lines.push(`4. Register the UI plugin in apps/ui/src/plugins/index.ts:`);
    lines.push(`   import { registerPlugin } from '${names.packageName}${type === 'fullstack' ? '/ui' : ''}';`);
    lines.push(`   registerPluginById('${names.pluginId}', registerPlugin);`);
    lines.push('');
  }

  if (type === 'backend' || type === 'fullstack') {
    const stepNum = type === 'fullstack' ? 5 : 4;
    lines.push(`${stepNum}. Register the backend plugin in forgeportal.yaml:`);
    lines.push(`   pluginPackages:`);
    lines.push(`     packages:`);
    lines.push(`       - "${names.packageName}"`);
    lines.push('');
  }

  lines.push(`Docs: https://github.com/your-org/forgeportal/tree/main/docs/plugin-development.md`);

  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
