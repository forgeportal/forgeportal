import type { FastifyRequest, FastifyReply } from 'fastify';
import { hasPermission, isRoleAtLeast, type Permission } from './rbac.js';

export function requirePermission(...required: Permission[]) {
  return async function checkPermission(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const identity = request.identity;
    if (!identity) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    for (const perm of required) {
      if (!hasPermission(identity.role, perm)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Missing permission: ${perm}`,
        });
      }
    }
  };
}

export function requireOwnership(
  getOwnerRef: (request: FastifyRequest) => Promise<string | null>,
) {
  return async function checkOwnership(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const identity = request.identity;
    if (!identity) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (isRoleAtLeast(identity.role, 'template-admin')) return;

    const ownerRef = await getOwnerRef(request);
    if (!ownerRef) return;

    if (identity.role === 'team-admin') {
      const normalizedOwner = ownerRef.startsWith('team:')
        ? ownerRef.slice(5)
        : ownerRef;
      if (!identity.scope.teams.includes(normalizedOwner)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only modify entities owned by your team',
        });
      }
      return;
    }

    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Insufficient role for this operation',
    });
  };
}
