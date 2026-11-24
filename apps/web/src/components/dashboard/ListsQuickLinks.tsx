import type { MdblistList } from '@findarr/shared/mdblist';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Icon } from '../ui/Icon';

interface ListsQuickLinksProps {
  lists: MdblistList[];
}

export function ListsQuickLinks({ lists }: ListsQuickLinksProps) {
  const { t } = useTranslation();

  if (lists.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold text-white md:text-2xl">
          {t('dashboard.lists.title')}
        </h2>
        <Link
          to="/lists"
          className="inline-flex items-center gap-1 text-sm font-medium text-amber-300 hover:text-amber-200"
        >
          {t('dashboard.lists.viewAll')}
          <Icon name="chevron_right" size="sm" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lists.map((list) => (
          <Link
            key={list.id}
            to={`/lists?list=${encodeURIComponent(list.id)}`}
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/45 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 md:p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 group-hover:text-amber-200">
              <Icon name="view_list" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-white group-hover:text-amber-100">
                {list.name}
              </span>
              <span className="block text-sm text-zinc-400">
                {t('lists.itemCount', { count: list.itemCount })}
              </span>
            </span>
            <Icon className="text-zinc-600 group-hover:text-zinc-300" name="chevron_right" />
          </Link>
        ))}
      </div>
    </section>
  );
}
