import type { MdblistList } from '@findarr/shared/mdblist';
import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useConnectionState } from '../../hooks/useConnectionState';
import { adminMdblistService, mdblistService } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import { asVoid } from '../../utils/asyncHandlers';
import { Button } from '../ui/Button';
import { InlineFeedback } from '../ui/InlineFeedback';
import { Input } from '../ui/Input';
import { SelectInput } from '../ui/SelectInput';
import { IntegrationCard } from './IntegrationCard';

const SYNC_PRESET_HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 168];

export function MdblistSection() {
  const { t } = useTranslation();
  const [lists, setLists] = useState<MdblistList[]>([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [intervalHours, setIntervalHours] = useState(6);

  const { isSaving, isTesting, feedback, clearFeedback, setError, setSuccess, wrapSave, wrapTest } =
    useConnectionState(async () => {
      const [loadedLists, syncSettings] = await Promise.all([
        mdblistService.listLists(),
        adminMdblistService.getSyncSettings(),
      ]);
      setLists(loadedLists);
      setIntervalHours(syncSettings.intervalHours);
    });

  function handleAdd(event: ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    void wrapSave(async () => {
      try {
        const added = await adminMdblistService.addList({
          url,
          ...(name.trim() === '' ? {} : { name }),
        });
        setLists((current) => [...current, added]);
        setUrl('');
        setName('');
        setSuccess(t('admin.mdblist.added'));
      } catch (error) {
        setError(`${t('admin.mdblist.addError')} (${getApiErrorMessage(error)})`);
      }
    });
  }

  async function handleRemove(id: string) {
    clearFeedback();
    try {
      await adminMdblistService.removeList(id);
      setLists((current) => current.filter((list) => list.id !== id));
      setSuccess(t('admin.mdblist.removed'));
    } catch (error) {
      setError(getApiErrorMessage(error));
    }
  }

  async function handleIntervalChange(hours: number) {
    clearFeedback();
    const previous = intervalHours;
    setIntervalHours(hours);
    try {
      const saved = await adminMdblistService.setSyncSettings({ intervalHours: hours });
      setIntervalHours(saved.intervalHours);
      setSuccess(t('admin.mdblist.scheduleSaved'));
    } catch (error) {
      setIntervalHours(previous);
      setError(getApiErrorMessage(error));
    }
  }

  function intervalLabel(hours: number): string {
    if (hours === 1) {
      return t('admin.mdblist.every.hour');
    }
    if (hours === 24) {
      return t('admin.mdblist.every.day');
    }
    if (hours === 168) {
      return t('admin.mdblist.every.week');
    }
    return hours % 24 === 0
      ? t('admin.mdblist.every.days', { count: hours / 24 })
      : t('admin.mdblist.every.hours', { count: hours });
  }

  // Keep an unusual saved value selectable instead of silently showing another one.
  const intervalOptions = SYNC_PRESET_HOURS.includes(intervalHours)
    ? SYNC_PRESET_HOURS
    : [...SYNC_PRESET_HOURS, intervalHours].toSorted((a, b) => a - b);

  async function handleSync() {
    await wrapTest(async () => {
      try {
        const { synced, failed } = await adminMdblistService.sync();
        setLists(await mdblistService.listLists());
        setSuccess(
          failed > 0
            ? t('admin.mdblist.syncedWithFailures', { synced, failed })
            : t('admin.mdblist.synced', { synced }),
        );
      } catch (error) {
        setError(getApiErrorMessage(error));
      }
    });
  }

  return (
    <IntegrationCard
      title={t('admin.mdblist.title')}
      description={t('admin.mdblist.description')}
      onSubmit={handleAdd}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isSaving || url.trim() === ''}>
              {isSaving ? t('admin.mdblist.adding') : t('admin.mdblist.add')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isTesting || lists.length === 0}
              onClick={asVoid(handleSync)}
            >
              {isTesting ? t('admin.mdblist.syncing') : t('admin.mdblist.sync')}
            </Button>
          </div>
          <div className="sm:min-h-10 sm:flex-1">
            {feedback && <InlineFeedback tone={feedback.tone} message={feedback.message} />}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label={t('admin.mdblist.urlLabel')}
          type="url"
          value={url}
          placeholder={t('admin.mdblist.urlPlaceholder')}
          onChange={(event) => {
            clearFeedback();
            setUrl(event.target.value);
          }}
        />
        <Input
          label={t('admin.mdblist.nameLabel')}
          value={name}
          maxLength={100}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />

        <div>
          <label className="mb-1.5 block text-sm text-zinc-300" htmlFor="mdblist-sync-interval">
            {t('admin.mdblist.scheduleLabel')}
          </label>
          <SelectInput
            id="mdblist-sync-interval"
            value={String(intervalHours)}
            onChange={(event) => {
              void handleIntervalChange(Number(event.target.value));
            }}
          >
            {intervalOptions.map((hours) => (
              <option key={hours} value={String(hours)}>
                {intervalLabel(hours)}
              </option>
            ))}
          </SelectInput>
          <p className="mt-1.5 text-xs text-zinc-500">{t('admin.mdblist.scheduleHint')}</p>
        </div>

        {lists.length === 0 ? (
          <p className="text-sm text-zinc-500">{t('admin.mdblist.noLists')}</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {lists.map((list) => (
              <li key={list.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <a
                    href={list.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-zinc-100 hover:text-amber-200"
                  >
                    {list.name}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {t('admin.mdblist.titles', { count: list.itemCount })}
                    {' · '}
                    {list.lastSyncedAt === null
                      ? t('admin.mdblist.neverSynced')
                      : t('admin.mdblist.lastSynced', {
                          date: new Date(list.lastSyncedAt).toLocaleString(),
                        })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={asVoid(async () => handleRemove(list.id))}
                >
                  {t('admin.mdblist.remove')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </IntegrationCard>
  );
}
