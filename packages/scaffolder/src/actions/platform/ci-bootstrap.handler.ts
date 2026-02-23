import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProviders } from '@forgeportal/scm';
import { buildRepoUrl, mapScmError } from '../scm/scm-error-mapper.js';

const LANGUAGE_DEFAULTS: Record<string, { build: string; test: string }> = {
  node:   { build: 'npm install', test: 'npm test' },
  java:   { build: 'mvn package -DskipTests', test: 'mvn test' },
  go:     { build: 'go build ./...', test: 'go test ./...' },
  python: { build: 'pip install -r requirements.txt', test: 'pytest' },
  other:  { build: 'echo "configure build command"', test: 'echo "configure test command"' },
};

function languageSetupSteps(language: string): string {
  switch (language) {
    case 'node':
      return '      - uses: actions/setup-node@v4\n        with:\n          node-version: 20';
    case 'java':
      return '      - uses: actions/setup-java@v4\n        with:\n          java-version: 21\n          distribution: temurin';
    case 'go':
      return '      - uses: actions/setup-go@v5\n        with:\n          go-version: 1.23';
    case 'python':
      return '      - uses: actions/setup-python@v5\n        with:\n          python-version: 3.12';
    default:
      return '';
  }
}

function languageImage(language: string): string {
  switch (language) {
    case 'node':   return 'image: node:20';
    case 'java':   return 'image: maven:3.9-eclipse-temurin-21';
    case 'go':     return 'image: golang:1.23';
    case 'python': return 'image: python:3.12';
    default:       return 'image: alpine:latest';
  }
}

function githubActionsTemplate(
  language: string,
  buildCmd: string,
  testCmd: string,
): string {
  const setupSteps = languageSetupSteps(language);
  const setupSection = setupSteps ? `${setupSteps}\n` : '';
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${setupSection}      - name: Build
        run: ${buildCmd}
      - name: Test
        run: ${testCmd}
`;
}

function gitlabCITemplate(language: string, buildCmd: string, testCmd: string): string {
  return `stages:
  - build
  - test

${languageImage(language)}

build:
  stage: build
  script:
    - ${buildCmd}

test:
  stage: test
  script:
    - ${testCmd}
`;
}

const ciBootstrapInputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  type: z.enum(['github-actions', 'gitlab-ci']),
  language: z.enum(['node', 'java', 'go', 'python', 'other']).default('node'),
  buildCommand: z.string().optional(),
  testCommand: z.string().optional(),
});

export class CiBootstrapHandler implements ActionHandler {
  readonly actionId = 'ci.bootstrap@v1';

  constructor(private readonly scmProviders: SCMProviders) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = ciBootstrapInputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, branch, type, language, buildCommand, testCommand } = parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    const defaults = LANGUAGE_DEFAULTS[language] ?? LANGUAGE_DEFAULTS['other'];
    const buildCmd = buildCommand ?? defaults.build;
    const testCmd = testCommand ?? defaults.test;

    const ref = { owner, repo };
    const repoUrl = buildRepoUrl(provider, owner, repo);

    let filePath: string;
    let content: string;

    if (type === 'github-actions') {
      filePath = '.github/workflows/ci.yml';
      content = githubActionsTemplate(language, buildCmd, testCmd);
    } else {
      filePath = '.gitlab-ci.yml';
      content = gitlabCITemplate(language, buildCmd, testCmd);
    }

    await ctx.acquireRepoLock(repoUrl);
    await ctx.log('info', `Bootstrapping CI (${type}, ${language}) at ${filePath}`);

    try {
      const existing = await scm.getFile(ref, filePath, branch);
      if (existing && existing.content === content) {
        await ctx.log('debug', `${filePath} already exists with same content — skipping`);
      } else {
        await scm.createOrUpdateFile(
          ref,
          filePath,
          content,
          'ci: bootstrap CI configuration',
          branch,
          existing?.sha,
        );
        await ctx.log('info', `Written: ${filePath}`);
      }
    } catch (err) {
      throw mapScmError(err, `createOrUpdateFile (${filePath})`);
    }

    return {
      status: 'success',
      outputs: { ciFile: filePath },
      links: [],
      warnings: [],
    };
  }
}
