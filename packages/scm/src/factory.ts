import fs from 'node:fs/promises';
import type { AppConfig } from '@forgeportal/core';
import type { SCMProvider } from './provider.js';
import { GitHubProvider } from './github.js';
import { GitLabProvider } from './gitlab.js';

export interface SCMProviders {
  github: GitHubProvider | null;
  gitlab: GitLabProvider | null;
  all(): SCMProvider[];
  get(name: 'github' | 'gitlab'): SCMProvider | null;
}

async function loadPrivateKey(pathOrPem: string): Promise<string> {
  if (
    pathOrPem.startsWith('/') ||
    pathOrPem.startsWith('.') ||
    pathOrPem.startsWith('\\')
  ) {
    return (await fs.readFile(pathOrPem, 'utf-8')).trim();
  }
  return pathOrPem;
}

export async function createSCMProviders(
  config: AppConfig,
  logger?: { info: (obj: unknown, msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<SCMProviders> {
  let github: GitHubProvider | null = null;
  let gitlab: GitLabProvider | null = null;

  const ghConfig = config.scm.github;
  if (ghConfig.appId && ghConfig.privateKeyPath) {
    try {
      const privateKey = await loadPrivateKey(ghConfig.privateKeyPath);
      github = new GitHubProvider({ appId: ghConfig.appId, privateKey });
    } catch (err) {
      logger?.error(
        { err },
        'Failed to initialize GitHub App provider — skipping',
      );
    }
  } else if (ghConfig.token) {
    try {
      github = new GitHubProvider({ token: ghConfig.token });
    } catch (err) {
      logger?.error(
        { err },
        'Failed to initialize GitHub PAT provider — skipping',
      );
    }
  }

  const glConfig = config.scm.gitlab;
  if (glConfig.token) {
    try {
      gitlab = new GitLabProvider({
        token: glConfig.token,
        baseUrl: glConfig.baseUrl,
      });
    } catch (err) {
      logger?.error(
        { err },
        'Failed to initialize GitLab provider — skipping',
      );
    }
  }

  logger?.info(
    { github: !!github, gitlab: !!gitlab },
    'SCM providers initialized',
  );

  if (!github && !gitlab) {
    logger?.warn(
      'No SCM providers configured — repo discovery and webhooks will be unavailable',
    );
  }

  return {
    github,
    gitlab,
    all() {
      return [github, gitlab].filter(Boolean) as SCMProvider[];
    },
    get(name) {
      if (name === 'github') return github;
      if (name === 'gitlab') return gitlab;
      return null;
    },
  };
}
