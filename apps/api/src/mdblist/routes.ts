import { MdblistItemsQuerySchema, MdblistListParamsSchema } from '@findarr/shared/mdblist';
import type { FastifyInstance } from 'fastify';

import { protectedRoute } from '../utils/routes.js';

export const mdblistRoutes = (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', fastify.requireAuth);

  fastify.get('/lists', async () => fastify.mdblist.listLists());

  fastify.get(
    '/lists/:id/preview',
    protectedRoute(async (request) => {
      const { id } = MdblistListParamsSchema.parse(request.params);
      return fastify.mdblist.getPreview(id, request.user.id);
    }),
  );

  fastify.get(
    '/lists/:id/items',
    protectedRoute(async (request) => {
      const { id } = MdblistListParamsSchema.parse(request.params);
      const { page } = MdblistItemsQuerySchema.parse(request.query);
      return fastify.mdblist.getItems(id, page, request.user.id);
    }),
  );
};
