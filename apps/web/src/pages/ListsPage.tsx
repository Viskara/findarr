import type { MdblistList } from '@findarr/shared/mdblist';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { AddListModal } from '../components/lists/AddListModal';
import { ListCard } from '../components/lists/ListCard';
import { ListsSidebar } from '../components/lists/ListsSidebar';
import { PaginatedMediaResults } from '../components/media/PaginatedMediaResults';
import { LoadingState, StateDisplay } from '../components/ui';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { useListFeed } from '../hooks/useListFeed';
import { useMediaNavigation } from '../hooks/useMediaNavigation';
import { useMediaUpdateSubscription } from '../hooks/useMediaUpdateSubscription';
import { mdblistService } from '../services/api';

export function ListsPage() {
  const { t } = useTranslation();
  const { goToMedia } = useMediaNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAddOpen, setIsAddOpen] = useState(false);
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

  const closeAdd = useCallback(() => {
    setIsAddOpen(false);
  }, []);

  const handleAdded = useCallback(
    (added: MdblistList[]) => {
      setLists((current) => [...(current ?? []), ...added]);
      // A single new list is the one the user wants to look at.
      const [only] = added;
      if (only !== undefined && added.length === 1) {
        setSearchParams({ list: only.id });
      }
    },
    [setSearchParams],
  );

  const requestedId = searchParams.get('list');
  const selected = lists?.find((list) => list.id === requestedId);

  const feed = useListFeed(selected?.id);
  useMediaUpdateSubscription(feed.updateItem);

  return (
    <div className="md:flex">
      {lists !== null && lists.length > 0 && (
        <ListsSidebar lists={lists} selectedId={selected?.id} />
      )}

      <div className="min-w-0 flex-1">
        <PageContainer>
          <div className="space-y-6 md:space-y-8">
            {selected && (
              <Link
                to="/lists"
                className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 md:hidden"
              >
                <Icon name="arrow_back" size="sm" />
                {t('lists.allLists')}
              </Link>
            )}

            <PageHeader
              title={selected?.name ?? t('lists.title')}
              description={
                selected
                  ? t('lists.itemCount', { count: selected.itemCount })
                  : t('lists.description')
              }
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setIsAddOpen(true);
                  }}
                >
                  <Icon name="add" size="sm" />
                  {t('lists.add.button')}
                </Button>
              }
            />

            {lists === null && (
              <LoadingState className="flex min-h-[50vh] items-center justify-center" />
            )}

            {lists?.length === 0 && (
              <StateDisplay title={t('lists.emptyTitle')} message={t('lists.emptyMessage')} />
            )}

            {lists !== null && lists.length > 0 && !selected && (
              <div className="grid gap-4 md:gap-5 2xl:grid-cols-2">
                {lists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            )}

            {selected &&
              (feed.error && feed.results.length === 0 ? (
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
              ))}
          </div>
        </PageContainer>
      </div>

      <AddListModal isOpen={isAddOpen} onClose={closeAdd} onAdded={handleAdded} />
    </div>
  );
}
