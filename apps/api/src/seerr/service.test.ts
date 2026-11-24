import { createServer, type Server } from 'node:http';

import { createDatabase } from '../db/service.js';
import { createSettingsService } from '../settings/service.js';
import { createMockAppLogger } from '../tests/helpers/mockServices.js';
import { createSeerrService } from './service.js';

async function createService() {
  const { db } = createDatabase(':memory:');
  const settings = createSettingsService(db);
  const service = await createSeerrService({ appLog: createMockAppLogger(), settings });
  return { service, settings };
}

describe('seerr user mappings', () => {
  it('starts empty and stores assignments per Findarr user', async () => {
    const { service } = await createService();

    await expect(service.getUserMappings()).resolves.toStrictEqual({});
    await expect(service.setUserMapping(2, 11)).resolves.toStrictEqual({ '2': 11 });
    await expect(service.setUserMapping(3, 12)).resolves.toStrictEqual({ '2': 11, '3': 12 });
    await expect(service.getUserMappings()).resolves.toStrictEqual({ '2': 11, '3': 12 });
  });

  it('reassigns and clears assignments', async () => {
    const { service } = await createService();
    await service.setUserMapping(2, 11);

    await expect(service.setUserMapping(2, 15)).resolves.toStrictEqual({ '2': 15 });
    await expect(service.setUserMapping(2, null)).resolves.toStrictEqual({});
    await expect(service.getUserMappings()).resolves.toStrictEqual({});
  });

  it('ignores a corrupted stored map instead of failing requests', async () => {
    const { service, settings } = await createService();
    await settings.set({ seerrUserMap: '{not json' });

    await expect(service.getUserMappings()).resolves.toStrictEqual({});
  });
});

describe('seerr requests on behalf of mapped users', () => {
  let server: Server;
  let baseUrl: string;
  const bodies: unknown[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      let text = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        text += String(chunk);
      });
      request.on('end', () => {
        bodies.push(text === '' ? undefined : JSON.parse(text));
        response.writeHead(201, { 'Content-Type': 'application/json' });
        response.end('{}');
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Test server did not bind to a port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    bodies.length = 0;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  async function createConfiguredService() {
    const { db } = createDatabase(':memory:');
    const settings = createSettingsService(db);
    await settings.set({ seerrUrl: baseUrl, seerrApiKey: 'key', seerrEnabled: 'true' });
    return createSeerrService({ appLog: createMockAppLogger(), settings });
  }

  it('uses the assigned Seerr user and falls back to the key owner otherwise', async () => {
    const service = await createConfiguredService();
    await service.setUserMapping(2, 11);

    await service.requestMedia({ mediaType: 'movie', tmdbId: 603 }, 2);
    await service.requestMedia({ mediaType: 'movie', tmdbId: 603 }, 3);
    await service.requestMedia({ mediaType: 'movie', tmdbId: 603 });

    expect(bodies).toStrictEqual([
      { mediaType: 'movie', mediaId: 603, userId: 11 },
      { mediaType: 'movie', mediaId: 603 },
      { mediaType: 'movie', mediaId: 603 },
    ]);
  });
});
