import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { createSeerrService, type SeerrService } from './service.js';

declare module 'fastify' {
  interface FastifyInstance {
    seerr: SeerrService;
  }
}

const seerrPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('seerr', await createSeerrService(fastify));
  fastify.appLog.scope('seerr').info('Seerr plugin registered');
};

export default fp(seerrPlugin, {
  name: 'seerr',
  dependencies: ['logger', 'settings'],
});
