import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { createMdblistService, type MdblistService } from './service.js';

declare module 'fastify' {
  interface FastifyInstance {
    mdblist: MdblistService;
  }
}

const mdblistPlugin = (fastify: FastifyInstance) => {
  fastify.decorate('mdblist', createMdblistService(fastify));
  fastify.appLog.scope('mdblist').info('MDBList plugin registered');
};

export default fp(mdblistPlugin, {
  name: 'mdblist',
  dependencies: ['database', 'settings', 'tmdb', 'user', 'media', 'logger'],
});
