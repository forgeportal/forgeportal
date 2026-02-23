import type { PluginType } from './names.js';

export interface CliArgs {
  /** Short plugin name from positional arg, e.g. "pagerduty" */
  name?:   string;
  /** Plugin type from --type flag */
  type?:   PluginType;
  /** npm org scope from --org flag, e.g. "@myorg" */
  org?:    string;
  /** Output parent directory (default: process.cwd()) */
  outDir?: string;
  /** Skip all prompts, use defaults */
  yes:     boolean;
}

const VALID_TYPES: PluginType[] = ['ui', 'backend', 'fullstack'];

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // skip "node" + script
  const result: CliArgs = { yes: false };

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;

    if (arg === '--type' || arg === '-t') {
      const val = args[++i] as PluginType | undefined;
      if (!val || !VALID_TYPES.includes(val)) {
        console.error(`Error: --type must be one of: ${VALID_TYPES.join(', ')}`);
        process.exit(1);
      }
      result.type = val;
    } else if (arg.startsWith('--type=')) {
      const val = arg.split('=')[1] as PluginType | undefined;
      if (!val || !VALID_TYPES.includes(val)) {
        console.error(`Error: --type must be one of: ${VALID_TYPES.join(', ')}`);
        process.exit(1);
      }
      result.type = val;
    } else if (arg === '--org' || arg === '-o') {
      result.org = args[++i];
    } else if (arg.startsWith('--org=')) {
      result.org = arg.split('=')[1];
    } else if (arg === '--out-dir' || arg === '--outDir') {
      result.outDir = args[++i];
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      result.name = arg;
    } else {
      console.error(`Unknown flag: ${arg}`);
      printHelp();
      process.exit(1);
    }
    i++;
  }

  return result;
}

function printHelp(): void {
  console.log(`
Usage: create-forge-plugin [name] [options]

Arguments:
  name              Short plugin ID (kebab-case), e.g. "pagerduty"

Options:
  --type, -t        Plugin type: ui | backend | fullstack
  --org, -o         npm scope, e.g. "@myorg"
  --out-dir         Output parent directory (default: current directory)
  --yes, -y         Skip prompts, use defaults
  --help, -h        Show this help

Examples:
  npx create-forge-plugin pagerduty --type ui --org @myorg
  npx create-forge-plugin slack-notify --type backend
  npx create-forge-plugin costview --type fullstack --org @acme
  `);
}
