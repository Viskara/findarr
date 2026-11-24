import {
  MDBLIST_PAGE_SIZE,
  MDBLIST_PREVIEW_SIZE,
  type MdblistAddQuery,
  type MdblistItemsResponse,
  type MdblistList,
  type MdblistPreview,
} from '@findarr/shared/mdblist';
import type { Media } from '@findarr/shared/media';
import { getErrorMessage, isDefined } from '@findarr/shared/utils';
import { z } from 'zod';

import type { MediaService } from '../media/service.js';
import type { SettingsService } from '../settings/service.js';
import type { TMDBService } from '../tmdb/service.js';
import type { UserService } from '../user/service.js';
import { createLruTtlCache } from '../utils/cacheHelper.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import type { AppLogger } from '../utils/logger.js';
import {
  defaultListName,
  fetchMdblistItems,
  mdblistPublicUrl,
  parseMdblistUrl,
  type MdblistRef,
} from './client.js';

const SETTINGS_KEY = 'mdblistLists';
export const MAX_LISTS = 50;

const StoredListSchema = z.object({
  id: z.string(),
  username: z.string(),
  slug: z.string(),
  name: z.string(),
  lastSyncedAt: z.number().nullable(),
  items: z.array(z.object({ tmdbId: z.number(), type: z.enum(['movie', 'tv']) })),
});

const StoredListsSchema = z.array(StoredListSchema);

type StoredList = z.infer<typeof StoredListSchema>;

export interface MdblistContext {
  settings: SettingsService;
  tmdb: TMDBService;
  user: UserService;
  media: MediaService;
  appLog: AppLogger;
}

function toPublic(list: StoredList): MdblistList {
  return {
    id: list.id,
    url: mdblistPublicUrl(list),
    name: list.name,
    itemCount: list.items.length,
    movieCount: list.items.filter((item) => item.type === 'movie').length,
    showCount: list.items.filter((item) => item.type === 'tv').length,
    lastSyncedAt: list.lastSyncedAt,
  };
}

export function createMdblistService(context: MdblistContext) {
  const { settings, tmdb, user, media } = context;
  const log = context.appLog.scope('mdblist');

  const previewCache = createLruTtlCache<MdblistPreview>(60 * 60 * 1000, 200);

  // Serializes read-modify-write cycles on the stored lists blob.
  let queue: Promise<unknown> = Promise.resolve();
  async function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => task());
    queue = run.catch(() => {});
    return run;
  }

  async function load(): Promise<StoredList[]> {
    const raw = await settings.get(SETTINGS_KEY);
    if (!isDefined(raw)) {
      return [];
    }
    try {
      return StoredListsSchema.parse(JSON.parse(raw));
    } catch (error) {
      log.error({ err: error }, 'Stored MDBList data is invalid, ignoring it');
      return [];
    }
  }

  async function save(lists: StoredList[]): Promise<void> {
    await settings.set({ [SETTINGS_KEY]: JSON.stringify(lists) });
  }

  async function listLists(): Promise<MdblistList[]> {
    const lists = await load();
    return lists.map((list) => toPublic(list));
  }

  async function addList(query: MdblistAddQuery): Promise<MdblistList> {
    const ref = parseMdblistUrl(query.url);

    return exclusive(async () => {
      const lists = await load();
      if (lists.length >= MAX_LISTS) {
        throw badRequest(`Too many lists (limit ${MAX_LISTS}). Remove one first.`);
      }
      const exists = lists.some(
        (list) =>
          list.username.toLowerCase() === ref.username.toLowerCase() &&
          list.slug.toLowerCase() === ref.slug.toLowerCase(),
      );
      if (exists) {
        throw conflict('This list has already been added');
      }

      const items = await fetchMdblistItems(ref).catch((error: unknown) => {
        log.warn({ err: error, ...ref }, 'Failed to fetch MDBList list');
        throw badRequest(`Could not load list from MDBList: ${getErrorMessage(error)}`);
      });

      const stored: StoredList = {
        id: crypto.randomUUID(),
        ...ref,
        name: isDefined(query.name) && query.name !== '' ? query.name : defaultListName(ref),
        lastSyncedAt: Date.now(),
        items,
      };

      await save([...lists, stored]);
      log.info({ ...ref, items: items.length }, 'Added MDBList list');
      return toPublic(stored);
    });
  }

  async function removeList(id: string): Promise<void> {
    await exclusive(async () => {
      const lists = await load();
      if (!lists.some((list) => list.id === id)) {
        throw notFound('List not found');
      }
      await save(lists.filter((list) => list.id !== id));
    });
  }

  /**
   * Re-download every list. A list that fails keeps its previous items.
   */
  async function syncAll(): Promise<{ synced: number; failed: number }> {
    const snapshot = await load();
    const fetched = new Map<string, StoredList['items']>();
    let failed = 0;

    for (const list of snapshot) {
      const ref: MdblistRef = { username: list.username, slug: list.slug };
      try {
        // oxlint-disable-next-line no-await-in-loop
        fetched.set(list.id, await fetchMdblistItems(ref));
      } catch (error) {
        failed += 1;
        log.warn({ err: error, ...ref }, 'Failed to sync MDBList list');
      }
    }

    await exclusive(async () => {
      const current = await load();
      const now = Date.now();
      await save(
        current.map((list) => {
          const items = fetched.get(list.id);
          return items ? { ...list, items, lastSyncedAt: now } : list;
        }),
      );
    });

    log.info({ synced: fetched.size, failed }, 'MDBList sync finished');
    return { synced: fetched.size, failed };
  }

  async function getItems(id: string, page: number, userId: number): Promise<MdblistItemsResponse> {
    const lists = await load();
    const list = lists.find((entry) => entry.id === id);
    if (!list) {
      throw notFound('List not found');
    }

    const start = (page - 1) * MDBLIST_PAGE_SIZE;
    const slice = list.items.slice(start, start + MDBLIST_PAGE_SIZE);
    const { language } = await user.getSettings(userId);

    const resolved = await Promise.all(
      slice.map(async (item): Promise<Media | undefined> => {
        try {
          return await tmdb.details({ id: item.tmdbId, type: item.type, language });
        } catch (error) {
          log.debug({ err: error, ...item }, 'Skipping MDBList item TMDB could not resolve');
          return undefined;
        }
      }),
    );

    const results = await media.enrichMediaResults(
      resolved.filter((item) => isDefined(item)),
      userId,
    );

    return {
      results,
      page,
      hasMore: start + MDBLIST_PAGE_SIZE < list.items.length,
      total: list.items.length,
    };
  }

  /**
   * First few titles of a list for the overview card. Cached because it costs
   * several TMDB lookups; the key changes whenever the list is re-synced.
   */
  async function getPreview(id: string, userId: number): Promise<MdblistPreview> {
    const lists = await load();
    const list = lists.find((entry) => entry.id === id);
    if (!list) {
      throw notFound('List not found');
    }

    const { language } = await user.getSettings(userId);

    return previewCache.getOrLoad(`${id}:${list.lastSyncedAt ?? 0}:${language}`, async () => {
      // Look a little past the preview size so unresolvable titles do not leave gaps.
      const candidates = list.items.slice(0, MDBLIST_PREVIEW_SIZE + 3);
      const resolved = await Promise.all(
        candidates.map(async (item): Promise<Media | undefined> => {
          try {
            return await tmdb.details({ id: item.tmdbId, type: item.type, language });
          } catch (error) {
            log.debug({ err: error, ...item }, 'Skipping MDBList preview item');
            return undefined;
          }
        }),
      );

      return {
        items: resolved
          .filter((item) => isDefined(item))
          .slice(0, MDBLIST_PREVIEW_SIZE)
          .map((item) => ({
            tmdbId: item.tmdbId,
            type: item.type,
            name: item.name,
            posterPath: item.posterPath ?? null,
          })),
      };
    });
  }

  return { listLists, addList, removeList, syncAll, getItems, getPreview };
}

export type MdblistService = ReturnType<typeof createMdblistService>;
