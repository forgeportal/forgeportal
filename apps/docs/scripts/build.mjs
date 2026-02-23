/**
 * Wrapper around `docusaurus build` that tolerates the ENOTEMPTY cleanup
 * error Docusaurus 3.9.x produces on Windows when removing the __server SSR
 * temp directory. The build artefact (build/index.html) is always valid after
 * the webpack compilation step.
 */
import { execSync }            from 'node:child_process';
import { existsSync, rmSync }  from 'node:fs';
import { fileURLToPath }       from 'node:url';
import { dirname, resolve }    from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir   = resolve(__dirname, '..');

try {
  execSync('docusaurus build', { stdio: 'inherit', cwd: rootDir });
} catch {
  // Force-clean the SSR temp dir that triggers ENOTEMPTY on Windows
  const serverDir = resolve(rootDir, 'build', '__server');
  try { rmSync(serverDir, { recursive: true, force: true }); } catch { /* noop */ }

  // Validate that the real build output was produced
  if (!existsSync(resolve(rootDir, 'build', 'index.html'))) {
    console.error('[build] FATAL: build/index.html not found — build truly failed.');
    process.exit(1);
  }
  console.log('[build] Build succeeded (Windows __server cleanup handled).');
}
