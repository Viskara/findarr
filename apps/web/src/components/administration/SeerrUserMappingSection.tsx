import type { SeerrUser, SeerrUserMappings } from '@findarr/shared/seerr';
import { getErrorMessage } from '@findarr/shared/utils';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUsers } from '../../hooks/useUsers';
import { adminSeerrService } from '../../services/api';
import { asVoid } from '../../utils/asyncHandlers';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { InlineFeedback } from '../ui/InlineFeedback';
import { SelectInput } from '../ui/SelectInput';

type LoadState = 'loading' | 'ready' | 'unavailable';

export function SeerrUserMappingSection() {
  const { t } = useTranslation();
  const { users } = useUsers();
  const [seerrUsers, setSeerrUsers] = useState<SeerrUser[]>([]);
  const [mappings, setMappings] = useState<SeerrUserMappings>({});
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [loadedUsers, loadedMappings] = await Promise.all([
        adminSeerrService.listUsers(),
        adminSeerrService.getMappings(),
      ]);
      setSeerrUsers(loadedUsers);
      setMappings(loadedMappings);
      setState('ready');
    } catch {
      setState('unavailable');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign(userId: number, seerrUserId: number | null) {
    setMessage(null);
    try {
      setMappings(await adminSeerrService.setMapping(userId, seerrUserId));
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  }

  async function matchByEmail() {
    setMessage(null);
    const byEmail = new Map(
      seerrUsers.flatMap((user) =>
        user.email === null ? [] : [[user.email.toLowerCase(), user.id] as const],
      ),
    );

    let matched = 0;
    try {
      let latest = mappings;
      for (const user of users) {
        const seerrId = byEmail.get(user.email.toLowerCase());
        if (seerrId !== undefined && latest[String(user.id)] !== seerrId) {
          // oxlint-disable-next-line no-await-in-loop
          latest = await adminSeerrService.setMapping(user.id, seerrId);
          matched += 1;
        }
      }
      setMappings(latest);
      setMessage({ tone: 'success', text: t('admin.seerrUsers.matched', { count: matched }) });
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  }

  return (
    <Card variant="solid" padding="none" className="overflow-hidden">
      <div className="border-b border-zinc-800 px-5 py-4 md:px-6">
        <h3 className="text-lg font-semibold text-white">{t('admin.seerrUsers.title')}</h3>
        <p className="mt-1 text-sm text-zinc-400">{t('admin.seerrUsers.description')}</p>
      </div>

      <div className="space-y-4 px-5 py-5 md:px-6">
        {state === 'loading' && <p className="text-sm text-zinc-500">{t('common.loading')}</p>}

        {state === 'unavailable' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-500">{t('admin.seerrUsers.unavailable')}</p>
            <Button type="button" size="sm" variant="secondary" onClick={asVoid(load)}>
              {t('admin.seerrUsers.retry')}
            </Button>
          </div>
        )}

        {state === 'ready' && (
          <>
            <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 sm:w-1/2">
                    <p className="truncate text-sm font-medium text-zinc-100">{user.displayName}</p>
                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                  </div>
                  <div className="sm:w-1/2">
                    <SelectInput
                      aria-label={t('admin.seerrUsers.selectFor', { name: user.displayName })}
                      value={mappings[String(user.id)]?.toString() ?? ''}
                      onChange={(event) => {
                        const { value } = event.target;
                        void assign(user.id, value === '' ? null : Number(value));
                      }}
                    >
                      <option value="">{t('admin.seerrUsers.default')}</option>
                      {seerrUsers.map((seerrUser) => (
                        <option key={seerrUser.id} value={seerrUser.id.toString()}>
                          {seerrUser.email === null
                            ? seerrUser.name
                            : `${seerrUser.name} (${seerrUser.email})`}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <Button type="button" size="sm" variant="secondary" onClick={asVoid(matchByEmail)}>
                {t('admin.seerrUsers.matchByEmail')}
              </Button>
              <div className="sm:min-h-10 sm:flex-1">
                {message && <InlineFeedback tone={message.tone} message={message.text} />}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
