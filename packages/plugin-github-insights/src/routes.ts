import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GitHubInsightsClient } from './api-client.js';
import type { GitHubInsightsConfig } from './types.js';

interface EntityParams  { entityId: string }
interface RepoQuery     { owner: string; repo: string }

/**
 * Creates Fastify route handlers for the GitHub Insights plugin.
 * All routes mounted under /api/v1/plugins/github-insights/ by the plugin loader.
 *
 * Routes:
 *   GET  entities/:entityId/overview      — repo info + open PR count + latest commit
 *   GET  entities/:entityId/prs           — paginated open PRs
 *   GET  entities/:entityId/commits       — last 20 commits
 *   GET  entities/:entityId/contributors  — top contributors
 */
export function createRoutes(config: GitHubInsightsConfig) {
  const client = new GitHubInsightsClient(config);

  return async function handler(fastify: FastifyInstance): Promise<void> {
    function requireOwnerRepo(
      request: FastifyRequest<{ Params: EntityParams; Querystring: RepoQuery }>,
      reply: FastifyReply,
    ): { owner: string; repo: string } | null {
      const { owner, repo } = request.query;
      if (!owner || !repo) {
        void reply.status(400).send({
          error:   'Bad Request',
          message: 'Query parameters "owner" and "repo" are required.',
        });
        return null;
      }
      return { owner, repo };
    }

    /**
     * GET /entities/:entityId/overview?owner=&repo=
     * Returns: repo metadata + open PR count + latest commit.
     */
    fastify.get(
      'entities/:entityId/overview',
      async (
        request: FastifyRequest<{ Params: EntityParams; Querystring: RepoQuery }>,
        reply:   FastifyReply,
      ) => {
        const ref = requireOwnerRepo(request, reply);
        if (!ref) return;

        try {
          const [repoData, prs, commits] = await Promise.allSettled([
            client.getRepo(ref.owner, ref.repo),
            client.getOpenPRs(ref.owner, ref.repo),
            client.getRecentCommits(ref.owner, ref.repo),
          ]);

          const repo        = repoData.status === 'fulfilled' ? repoData.value : null;
          const openPRCount = prs.status === 'fulfilled' ? prs.value.length : 0;
          const latestCommit = commits.status === 'fulfilled' ? (commits.value[0] ?? null) : null;

          if (!repo) {
            const err = repoData.status === 'rejected' ? repoData.reason : new Error('Unknown');
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('not found')) {
              return reply.status(404).send({ error: 'Not Found', message });
            }
            return reply.status(502).send({ error: 'Bad Gateway', message });
          }

          return reply.send({ data: { repo, openPRCount, latestCommit } });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'github-insights: getOverview failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );

    /**
     * GET /entities/:entityId/prs?owner=&repo=
     * Returns up to 25 open pull requests.
     */
    fastify.get(
      'entities/:entityId/prs',
      async (
        request: FastifyRequest<{ Params: EntityParams; Querystring: RepoQuery }>,
        reply:   FastifyReply,
      ) => {
        const ref = requireOwnerRepo(request, reply);
        if (!ref) return;

        try {
          const prs = await client.getOpenPRs(ref.owner, ref.repo);
          return reply.send({ data: prs });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'github-insights: getPRs failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );

    /**
     * GET /entities/:entityId/commits?owner=&repo=
     * Returns the last 20 commits.
     */
    fastify.get(
      'entities/:entityId/commits',
      async (
        request: FastifyRequest<{ Params: EntityParams; Querystring: RepoQuery }>,
        reply:   FastifyReply,
      ) => {
        const ref = requireOwnerRepo(request, reply);
        if (!ref) return;

        try {
          const commits = await client.getRecentCommits(ref.owner, ref.repo);
          return reply.send({ data: commits });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'github-insights: getCommits failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );

    /**
     * GET /entities/:entityId/contributors?owner=&repo=
     * Returns top contributors by commit count.
     */
    fastify.get(
      'entities/:entityId/contributors',
      async (
        request: FastifyRequest<{ Params: EntityParams; Querystring: RepoQuery }>,
        reply:   FastifyReply,
      ) => {
        const ref = requireOwnerRepo(request, reply);
        if (!ref) return;

        try {
          const contributors = await client.getContributors(ref.owner, ref.repo);
          return reply.send({ data: contributors.slice(0, 5) });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'github-insights: getContributors failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );
  };
}
