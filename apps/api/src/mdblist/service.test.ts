import { createDatabase } from '../db/service.js';
import { createMediaService } from '../media/service.js';
import { createSettingsService } from '../settings/service.js';
import { createMockAppLogger, createMockTMDBService } from '../tests/helpers/mockServices.js';
import { createTestMovieDetail, createTestUserInDb } from '../tests/helpers/testHelper.js';
import type { TMDBService } from '../tmdb/service.js';
import { createUserService } from '../user/service.js';
import { createMdblistService } from './service.js';

const items = [
  { tmdbId: 1, type: 'movie' },
  { tmdbId: 2, type: 'tv' },
  { tmdbId: 3, type: 'movie' },
  { tmdbId: 4, type: 'movie' },
  { tmdbId: 5, type: 'tv' },
  { tmdbId: 6, type: 'movie' },
  { tmdbId: 7, type: 'movie' },
];

async function setup(details: TMDBService['details']) {
  const { db } = createDatabase(':memory:');
  const appLog = createMockAppLogger();
  const settings = createSettingsService(db);
  const user = createUserService({ db });
  const tmdb = createMockTMDBService({ details: vi.fn<TMDBService['details']>(details) });
  const media = createMediaService({ db, tmdb, user, appLog });
  const account = await createTestUserInDb(db, { email: 'lists@test.com' });
  await settings.set({
    mdblistLists: JSON.stringify([
      {
        id: 'list-1',
        username: 'someone',
        slug: 'my-list',
        name: 'My List',
        lastSyncedAt: 100,
        items,
      },
    ]),
  });

  return {
    tmdb,
    userId: account?.id ?? 0,
    service: createMdblistService({ settings, tmdb, user, media, appLog }),
  };
}

describe('mdblist overview data', () => {
  it('reports the movie / show split', async () => {
    const { service } = await setup(vi.fn());

    await expect(service.listLists()).resolves.toMatchObject([
      {
        id: 'list-1',
        name: 'My List',
        url: 'https://mdblist.com/lists/someone/my-list',
        itemCount: 7,
        movieCount: 5,
        showCount: 2,
      },
    ]);
  });

  it('previews the first five resolvable titles and skips ones TMDB cannot find', async () => {
    const { service, userId } = await setup(async ({ id }) => {
      if (id === 2) {
        throw new Error('not found');
      }
      return createTestMovieDetail({ tmdbId: id });
    });

    const preview = await service.getPreview('list-1', userId);

    expect(preview.items.map((item) => item.tmdbId)).toStrictEqual([1, 3, 4, 5, 6]);
  });

  it('caches previews so repeat views do not hit TMDB again', async () => {
    const { service, tmdb, userId } = await setup(async ({ id }) =>
      createTestMovieDetail({ tmdbId: id }),
    );

    await service.getPreview('list-1', userId);
    const callsAfterFirst = tmdb.details.mock.calls.length;
    await service.getPreview('list-1', userId);

    expect(tmdb.details).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('rejects previews for unknown lists', async () => {
    const { service, userId } = await setup(vi.fn());

    await expect(service.getPreview('missing', userId)).rejects.toThrow(/not found/iu);
  });
});
