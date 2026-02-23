import type { FastifyRequest, FastifyReply } from 'fastify';

const CSP_VALUE =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'";

export function docsCSPHook(
  request: FastifyRequest,
  reply: FastifyReply,
  _payload: unknown,
  done: () => void,
): void {
  if (request.url.startsWith('/api/v1/docs/')) {
    reply.header('Content-Security-Policy', CSP_VALUE);
  }
  done();
}
