import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { deriveNames } from '../names.js';
import { scaffoldPlugin } from '../scaffolder.js';

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-plugin-test-'));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('scaffoldPlugin', () => {
  it('creates all UI plugin files', async () => {
    await withTempDir(async (tmpDir) => {
      const names  = deriveNames('pagerduty', '@acme');
      const result = await scaffoldPlugin(names, 'ui', tmpDir);

      expect(result.filesCreated).toContain('forgeportal-plugin.json');
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('tsconfig.json');
      expect(result.filesCreated).toContain('README.md');
      expect(result.filesCreated).toContain('src/index.ts');
      expect(result.filesCreated).toContain('src/PagerdutyTab.tsx');
    });
  });

  it('creates all backend plugin files', async () => {
    await withTempDir(async (tmpDir) => {
      const names  = deriveNames('slack-notify');
      const result = await scaffoldPlugin(names, 'backend', tmpDir);

      expect(result.filesCreated).toContain('src/index.ts');
      expect(result.filesCreated).toContain('src/actions/slackNotifyAction.ts');
      expect(result.filesCreated).toContain('src/routes.ts');
      // UI files must NOT be present
      expect(result.filesCreated).not.toContain('src/SlackNotifyTab.tsx');
    });
  });

  it('creates all fullstack plugin files', async () => {
    await withTempDir(async (tmpDir) => {
      const names  = deriveNames('costview', '@myco');
      const result = await scaffoldPlugin(names, 'fullstack', tmpDir);

      expect(result.filesCreated).toContain('src/ui/index.ts');
      expect(result.filesCreated).toContain('src/ui/CostviewCard.tsx');
      expect(result.filesCreated).toContain('src/backend/index.ts');
      expect(result.filesCreated).toContain('src/backend/actions/costviewAction.ts');
      expect(result.filesCreated).toContain('src/backend/routes.ts');
      expect(result.filesCreated).toContain('src/index.ts');
    });
  });

  it('throws if target directory already exists', async () => {
    await withTempDir(async (tmpDir) => {
      const names = deriveNames('duplicate');
      await fs.mkdir(path.join(tmpDir, names.dirName));

      await expect(
        scaffoldPlugin(names, 'ui', tmpDir),
      ).rejects.toThrow('already exists');
    });
  });

  it('generated package.json is valid JSON with correct name', async () => {
    await withTempDir(async (tmpDir) => {
      const names  = deriveNames('pagerduty', '@acme');
      const result = await scaffoldPlugin(names, 'ui', tmpDir);

      const pkgPath = path.join(result.targetDir, 'package.json');
      const pkg     = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as { name: string };
      expect(pkg.name).toBe('@acme/forge-plugin-pagerduty');
    });
  });

  it('generated forgeportal-plugin.json is valid JSON', async () => {
    await withTempDir(async (tmpDir) => {
      const names  = deriveNames('test-plugin');
      const result = await scaffoldPlugin(names, 'backend', tmpDir);

      const manifestPath = path.join(result.targetDir, 'forgeportal-plugin.json');
      const manifest     = JSON.parse(
        await fs.readFile(manifestPath, 'utf8'),
      ) as { forgeportal: { type: string } };
      expect(manifest.forgeportal.type).toBe('backend');
    });
  });
});
