import type { SeerrUser } from '@findarr/shared/seerr';
import { create, isAxiosError } from 'axios';
import { z } from 'zod';

import type { AppLogger } from '../utils/logger.js';

export interface SeerrRequestParams {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  /** TV only. Omit to request every season. */
  seasons?: number[] | undefined;
  /** Seerr user the request is made on behalf of. Omit to use the API key's owner. */
  userId?: number | undefined;
}

const USER_PAGE_SIZE = 100;
const MAX_USER_PAGES = 50;

const UserPageSchema = z.object({
  results: z.array(
    z.object({
      id: z.number().int(),
      email: z.string().nullish(),
      displayName: z.string().nullish(),
      username: z.string().nullish(),
      jellyfinUsername: z.string().nullish(),
      plexUsername: z.string().nullish(),
    }),
  ),
});

/**
 * Seerr (Overseerr / Jellyseerr) API client. Requests are created with the
 * API key's own user, so they are auto-approved when that user is an admin.
 */
export function createSeerrClient(baseUrl: string, apiKey: string, appLog: AppLogger) {
  const log = appLog.scope('seerr');
  const http = create({
    baseURL: `${baseUrl}/api/v1`,
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    timeout: 15_000,
  });

  return {
    async testConnection(): Promise<boolean> {
      try {
        // auth/me needs a valid API key, unlike the public /status endpoint.
        await http.get('/auth/me', { timeout: 5000 });
        return true;
      } catch (error) {
        log.warn({ err: error }, 'Connection test failed');
        return false;
      }
    },

    async listUsers(): Promise<SeerrUser[]> {
      const users: SeerrUser[] = [];

      for (let page = 0; page < MAX_USER_PAGES; page += 1) {
        // oxlint-disable-next-line no-await-in-loop
        const response = await http.get<unknown>('/user', {
          params: { take: USER_PAGE_SIZE, skip: page * USER_PAGE_SIZE },
        });
        const { results } = UserPageSchema.parse(response.data);

        for (const user of results) {
          const name = [
            user.displayName,
            user.username,
            user.jellyfinUsername,
            user.plexUsername,
            user.email,
          ].find((value) => typeof value === 'string' && value !== '');
          users.push({
            id: user.id,
            name: name ?? `User ${user.id}`,
            email: user.email ?? null,
          });
        }

        if (results.length < USER_PAGE_SIZE) {
          break;
        }
      }

      return users;
    },

    async requestMedia({ mediaType, tmdbId, seasons, userId }: SeerrRequestParams): Promise<void> {
      try {
        await http.post('/request', {
          mediaType,
          mediaId: tmdbId,
          ...(mediaType === 'tv' ? { seasons: seasons ?? 'all' } : {}),
          ...(userId === undefined ? {} : { userId }),
        });
      } catch (error) {
        // Seerr answers 409 when the title (or those seasons) is already requested.
        if (isAxiosError(error) && error.response?.status === 409) {
          log.debug({ mediaType, tmdbId }, 'Already requested in Seerr');
          return;
        }
        throw error;
      }
    },
  };
}

export type SeerrClient = ReturnType<typeof createSeerrClient>;
