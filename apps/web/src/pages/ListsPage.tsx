import type { MdblistList } from '@findarr/shared/mdblist';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { PaginatedMediaResults } from '../components/media/PaginatedMediaResults';
import { LoadingState, StateDisplay } from '../components/ui';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { QuickActionBar } from '../components/ui/QuickActionBar';
import { useListFeed } from '../hooks/useListFeed';
import { useMediaNavigation } from '../hooks/useMediaNavigation';
import { useMediaUpdateSubscription } from '../hooks/useMediaUpdateSubscription';
import { useSession } from '../hooks/useSession';
import { mdblistService } from '../services/api';

export function ListsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useSession();
  const { goToMedia } = useMediaNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lists, setLists] = useState<MdblistList[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadLists = async () => {
      let loaded: MdblistList[] = [];
      try {
        loaded = await mdblistService.listLists();
      } catch {
        // An empty list set renders the empty state.
      }
      if (!cancelled) {
        setLists(loaded);
      }
    };
    void loadLists();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestedId = searchParams.get('list');
  const selected = lists?.find((list) => list.id === requestedId) ?? lists?.[0];

  const feed = useListFeed(selected?.id);
  useMediaUpdateSubscription(feed.updateItem);

  return (
    <PageContainer>
      <div className="space-y-6 md:space-y-8">
        <PageHeader
          title={selected?.name ?? t('lists.title')}
          description={
            selected ? t('lists.itemCount', { count: selected.itemCount }) : t('lists.description')
          }
        />

        {lists === null && (
          <LoadingState className="flex min-h-[50vh] items-center justify-center" />
        )}

        {lists?.length === 0 && (
          <StateDisplay
            title={t('lists.emptyTitle')}
            message={isAdmin ? t('lists.emptyMessageAdmin') : t('lists.emptyMessage')}
            action={
              isAdmin ? (
                <Link
                  to="/admin/administration"
                  className="text-sm font-medium text-amber-300 hover:text-amber-200"
                >
                  {t('lists.openAdmin')}
                </Link>
              ) : undefined
            }
          />
        )}

        {lists !== null && lists.length > 0 && (
          <>
            {lists.length > 1 && (
              <QuickActionBar
                items={lists.map((list) => ({
                  id: list.id,
                  label: list.name,
                  icon: 'view_list',
                  selected: list.id === selected?.id,
                  onClick: () => {
                    setSearchParams({ list: list.id }, { replace: true });
                  },
                }))}
              />
            )}

            {feed.error && feed.results.length === 0 ? (
              <StateDisplay title={t('lists.loadError')} />
            ) : (
              <PaginatedMediaResults
                results={feed.results}
                loading={feed.loading}
                loadingMore={feed.loadingMore}
                hasMore={feed.hasMore}
                onSelectItem={goToMedia}
                onUpdateItem={feed.updateItem}
                onLoadMore={feed.loadMore}
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
