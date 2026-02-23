import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginNames, PluginType } from './names.js';
import {
  genManifest, genPackageJson, genTsConfig, genReadme,
  genUiIndex, genUiTab,
  genBackendIndex, genBackendAction, genBackendRoutes,
  genFullstackUiIndex, genFullstackCard, genFullstackBackendIndex,
} from './templates.js';

export interface ScaffoldResult {
  targetDir:    string;
  filesCreated: string[];
}

/**
 * Writes all generated files for the plugin to the target directory.
 * Throws if the target directory already exists.
 */
export async function scaffoldPlugin(
  names:     PluginNames,
  type:      PluginType,
  parentDir: string,
): Promise<ScaffoldResult> {
  const targetDir    = path.join(parentDir, names.dirName);
  const filesCreated: string[] = [];

  // Guard: refuse to overwrite existing directory
  try {
    await fs.access(targetDir);
    throw new Error(
      `Directory "${names.dirName}" already exists in ${parentDir}. ` +
      `Remove it first or choose a different plugin ID.`,
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  async function write(relPath: string, content: string): Promise<void> {
    const absPath = path.join(targetDir, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf8');
    filesCreated.push(relPath);
  }

  // ── Shared files ────────────────────────────────────────────────────────────
  await write('forgeportal-plugin.json', genManifest(names, type));
  await write('package.json',            genPackageJson(names, type));
  await write('tsconfig.json',           genTsConfig(type));
  await write('README.md',               genReadme(names, type));

  // ── Type-specific files ─────────────────────────────────────────────────────
  if (type === 'ui') {
    await write('src/index.ts',                    genUiIndex(names));
    await write(`src/${names.pascalName}Tab.tsx`,  genUiTab(names));
  } else if (type === 'backend') {
    await write('src/index.ts',                              genBackendIndex(names));
    await write(`src/actions/${names.camelName}Action.ts`,   genBackendAction(names));
    await write('src/routes.ts',                             genBackendRoutes(names));
  } else if (type === 'fullstack') {
    await write('src/ui/index.ts',                                 genFullstackUiIndex(names));
    await write(`src/ui/${names.pascalName}Card.tsx`,              genFullstackCard(names));
    await write('src/backend/index.ts',                            genFullstackBackendIndex(names));
    await write(`src/backend/actions/${names.camelName}Action.ts`, genBackendAction(names));
    await write('src/backend/routes.ts',                           genBackendRoutes(names));
    await write('src/index.ts',
      `// Re-export entry points for both plugin types\nexport * from './ui/index.js';\nexport * from './backend/index.js';\n`,
    );
  }

  return { targetDir, filesCreated };
}
