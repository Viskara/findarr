import { create, isAxiosError } from 'axios';

import type { AppLogger } from '../utils/logger.js';

export interface SeerrRequestParams {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  /** TV only. Omit to request every season. */
  seasons?: number[] | undefined;
}

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

    async requestMedia({ mediaType, tmdbId, seasons }: SeerrRequestParams): Promise<void> {
      try {
        await http.post('/request', {
          mediaType,
          mediaId: tmdbId,
          ...(mediaType === 'tv' ? { seasons: seasons ?? 'all' } : {}),
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
