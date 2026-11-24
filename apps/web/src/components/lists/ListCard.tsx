import {
  MDBLIST_PREVIEW_SIZE,
  type MdblistList,
  type MdblistPreview,
} from '@findarr/shared/mdblist';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { mdblistService } from '../../services/api';
import { tmdbImage } from '../../utils/tmdb';
import { Icon } from '../ui/Icon';

interface ListCardProps {
  list: MdblistList;
}

type PreviewState = MdblistPreview | 'loading' | 'failed';

function PosterTile({ children }: React.PropsWithChildren) {
  return (
    <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
      {children}
    </div>
  );
}

export function ListCard({ list }: ListCardProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<PreviewState>('loading');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let next: PreviewState = 'failed';
      try {
        next = await mdblistService.getPreview(list.id);
      } catch {
        // The card still works without posters.
      }
      if (!cancelled) {
        setPreview(next);
      }
    };
    setPreview('loading');
    void load();
    return () => {
      cancelled = true;
    };
  }, [list.id, list.lastSyncedAt]);

  const typeLabel =
    list.movieCount > 0 && list.showCount > 0
      ? t('lists.typeMixed')
      : list.showCount > 0
        ? t('catalog.typeShows')
        : t('catalog.typeMovies');
  const typeIcon = list.showCount > 0 && list.movieCount === 0 ? 'tv' : 'movie';
  const hiddenCount = Math.max(0, list.itemCount - (MDBLIST_PREVIEW_SIZE - 1));

  return (
    <Link
      to={`/lists?list=${encodeURIComponent(list.id)}`}
      className="group block rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 md:p-5"
    >
      <div className="flex items-center gap-3 md:gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 md:h-14 md:w-14">
          <Icon name="view_list" size="lg" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-white group-hover:text-amber-100 md:text-xl">
            {list.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Icon name="person" size="xs" />
              <span className="truncate">{`@${list.username}`}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="view_list" size="xs" />
              {t('lists.itemCount', { count: list.itemCount })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name={typeIcon} size="xs" />
              {typeLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2 md:gap-3">
        {preview === 'loading' &&
          Array.from({ length: MDBLIST_PREVIEW_SIZE }).map((_, index) => (
            // oxlint-disable-next-line react/no-array-index-key
            <PosterTile key={index}>
              <div className="h-full w-full animate-pulse bg-zinc-800/60" />
            </PosterTile>
          ))}

        {preview !== 'loading' &&
          preview !== 'failed' &&
          preview.items.map((item, index) => {
            const isLast = index === MDBLIST_PREVIEW_SIZE - 1 && hiddenCount > 0;
            return (
              <PosterTile key={`${item.type}_${item.tmdbId}`}>
                {item.posterPath === null ? (
                  <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-zinc-500">
                    {item.name}
                  </div>
                ) : (
                  <img
                    src={tmdbImage(item.posterPath, 'w185')}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
                {isLast && (
                  <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/60 text-base font-semibold text-white md:text-xl">
                    {`+${String(hiddenCount)}`}
                    <Icon name="chevron_right" size="sm" />
                  </div>
                )}
              </PosterTile>
            );
          })}

        {preview === 'failed' && (
          <p className="col-span-5 py-6 text-center text-sm text-zinc-500">
            {t('lists.previewUnavailable')}
          </p>
        )}
      </div>
    </Link>
  );
}
