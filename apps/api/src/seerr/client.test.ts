import { createServer, type IncomingMessage, type Server } from 'node:http';

import { createMockAppLogger } from '../tests/helpers/mockServices.js';
import { createSeerrClient } from './client.js';

interface Recorded {
  method: string | undefined;
  url: string | undefined;
  apiKey: string | string[] | undefined;
  body: unknown;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  request.setEncoding('utf8');
  let text = '';
  for await (const chunk of request) {
    text += String(chunk);
  }
  return text === '' ? undefined : JSON.parse(text);
}

describe('seerr client', () => {
  let server: Server;
  let baseUrl: string;
  let respondWith = 201;
  let users: Record<string, unknown>[] = [];
  const recorded: Recorded[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      const handle = async () => {
        const body = await readBody(request);
        recorded.push({
          method: request.method,
          url: request.url,
          apiKey: request.headers['x-api-key'],
          body,
        });
        const isUserList = request.url?.startsWith('/api/v1/user?') === true;
        const status = request.url === '/api/v1/auth/me' || isUserList ? 200 : respondWith;
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(isUserList ? JSON.stringify({ results: users }) : '{}');
      };
      void handle();
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
    recorded.length = 0;
    respondWith = 201;
    users = [];
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  it('verifies the API key through auth/me', async () => {
    const client = createSeerrClient(baseUrl, 'secret', createMockAppLogger());

    await expect(client.testConnection()).resolves.toBe(true);
    expect(recorded[0]).toMatchObject({ url: '/api/v1/auth/me', apiKey: 'secret' });
  });

  it('requests a movie without a seasons field', async () => {
    const client = createSeerrClient(baseUrl, 'secret', createMockAppLogger());

    await client.requestMedia({ mediaType: 'movie', tmdbId: 603 });

    expect(recorded[0]).toMatchObject({
      method: 'POST',
      url: '/api/v1/request',
      body: { mediaType: 'movie', mediaId: 603 },
    });
    expect(recorded[0]?.body).not.toHaveProperty('seasons');
  });

  it('requests all seasons of a show unless seasons are given', async () => {
    const client = createSeerrClient(baseUrl, 'secret', createMockAppLogger());

    await client.requestMedia({ mediaType: 'tv', tmdbId: 1396 });
    await client.requestMedia({ mediaType: 'tv', tmdbId: 1396, seasons: [1, 2] });

    expect(recorded[0]?.body).toStrictEqual({ mediaType: 'tv', mediaId: 1396, seasons: 'all' });
    expect(recorded[1]?.body).toStrictEqual({ mediaType: 'tv', mediaId: 1396, seasons: [1, 2] });
  });

  it('sends the Seerr user id when requesting on behalf of someone', async () => {
    const client = createSeerrClient(baseUrl, 'secret', createMockAppLogger());

    await client.requestMedia({ mediaType: 'movie', tmdbId: 603, userId: 7 });

    expect(recorded[0]?.body).toStrictEqual({ mediaType: 'movie', mediaId: 603, userId: 7 });
  });

  it('lists Seerr users with a readable name and email', async () => {
    users = [
      { id: 1, displayName: 'Admin', email: 'admin@example.com' },
      { id: 2, username: 'sam', email: 'sam@example.com' },
      { id: 3, email: 'only-email@example.com' },
      { id: 4 },
    ];
    const client = createSeerrClient(baseUrl, 'secret', createMockAppLogger());

    await expect(client.listUsers()).resolves.toStrictEqual([
      { id: 1, name: 'Admin', email: 'admin@example.com' },
      { id: 2, name: 'sam', email: 'sam@example.com' },
      { id: 3, name: 'only-email@example.com', email: 'only-email@example.com' },
      { id: 4, name: 'User 4', email: null },
    ]);
    expect(recorded[0]?.url).toContain('take=100');
  });

  it('treats 409 (already requested) as success but surfaces other errors', async () => {
    const client = createSeerrClient(baseUrl, 'secret', createMockAppLogger());

    respondWith = 409;
    await expect(client.requestMedia({ mediaType: 'movie', tmdbId: 603 })).resolves.toBeUndefined();

    respondWith = 500;
    await expect(client.requestMedia({ mediaType: 'movie', tmdbId: 603 })).rejects.toThrow(/500/u);
  });
});
