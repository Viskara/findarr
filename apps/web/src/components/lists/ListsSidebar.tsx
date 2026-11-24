import type { MdblistList } from '@findarr/shared/mdblist';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Icon } from '../ui/Icon';

interface ListsSidebarProps {
  lists: MdblistList[];
  /** Undefined while the overview of all lists is showing. */
  selectedId: string | undefined;
}

const itemClass = (isActive: boolean) =>
  `flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
    isActive
      ? 'border-amber-400/35 bg-amber-400/10 text-amber-100'
      : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/80 hover:text-zinc-100'
  }`;

export function ListsSidebar({ lists, selectedId }: ListsSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-800/80 bg-zinc-950/60 md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto">
      <nav className="p-4" aria-label={t('lists.title')}>
        <div className="mb-3 px-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          {t('lists.sidebarTitle')}
        </div>
        <ul className="space-y-1">
          <li>
            <Link
              to="/lists"
              replace
              className={itemClass(selectedId === undefined)}
              aria-current={selectedId === undefined ? 'page' : undefined}
            >
              <Icon name="apps" size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {t('lists.allLists')}
              </span>
              <span className="text-xs text-zinc-500">{lists.length}</span>
            </Link>
          </li>
          {lists.map((list) => {
            const isActive = list.id === selectedId;
            return (
              <li key={list.id}>
                <Link
                  to={`/lists?list=${encodeURIComponent(list.id)}`}
                  replace
                  className={itemClass(isActive)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon name="view_list" filled={isActive} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{list.name}</span>
                  <span className="text-xs text-zinc-500">{list.itemCount}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
