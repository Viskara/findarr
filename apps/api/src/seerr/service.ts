import type { SeerrUser, SeerrUserMappings } from '@findarr/shared/seerr';
import type { LibSettings, LibSettingsQuery } from '@findarr/shared/settings';
import { isDefined } from '@findarr/shared/utils';
import { z } from 'zod';

import type { SettingsService } from '../settings/service.js';
import { createClientLifecycle } from '../utils/clientLifecycleHelper.js';
import { trimTrailingSlash } from '../utils/links.js';
import type { AppLogger } from '../utils/logger.js';
import { createSeerrClient, type SeerrClient, type SeerrRequestParams } from './client.js';

const USER_MAP_KEY = 'seerrUserMap';
const MappingsSchema = z.record(z.string(), z.number().int().positive());

const KEYS = { url: 'seerrUrl', apiKey: 'seerrApiKey', enabled: 'seerrEnabled' } as const;

type SeerrSettingsFull = LibSettings & { apiKey: string | null };

export interface SeerrServiceContext {
  appLog: AppLogger;
  settings: SettingsService;
}

export async function createSeerrService(context: SeerrServiceContext) {
  async function loadSettings(): Promise<SeerrSettingsFull> {
    const stored = await context.settings.getAll();
    const url = stored[KEYS.url];
    const apiKey = stored[KEYS.apiKey];

    return {
      url: url ?? null,
      apiKey: apiKey ?? null,
      apiKeySet: isDefined(apiKey),
      enabled: isDefined(stored[KEYS.enabled]) ? stored[KEYS.enabled] === 'true' : isDefined(url),
    };
  }

  const lifecycle = createClientLifecycle<SeerrSettingsFull, SeerrClient>({
    name: 'Seerr',
    loadSettings,
    createClient: (settings) =>
      settings.enabled && isDefined(settings.url) && isDefined(settings.apiKey)
        ? createSeerrClient(trimTrailingSlash(settings.url), settings.apiKey, context.appLog)
        : undefined,
  });

  await lifecycle.reload().catch((error: unknown) => {
    context.appLog.scope('seerr').error({ error }, 'Failed to initialize Seerr service');
  });

  function getSettings(): LibSettings {
    const { apiKey: _apiKey, ...settings } = lifecycle.settings();
    return settings;
  }

  async function setSettings(query: LibSettingsQuery): Promise<LibSettings> {
    await context.settings.set({
      [KEYS.url]: query.url,
      [KEYS.apiKey]: query.apiKey,
      [KEYS.enabled]: query.enabled?.toString(),
    });
    await lifecycle.reload();
    return getSettings();
  }

  function isConfigured(): boolean {
    return lifecycle.isConfigured();
  }

  async function testConnection(): Promise<boolean> {
    return lifecycle.isConfigured() && (await lifecycle.client().testConnection());
  }

  async function listUsers(): Promise<SeerrUser[]> {
    return lifecycle.client().listUsers();
  }

  async function getUserMappings(): Promise<SeerrUserMappings> {
    const raw = await context.settings.get(USER_MAP_KEY);
    if (!isDefined(raw)) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return MappingsSchema.parse(parsed);
    } catch (error) {
      context.appLog.scope('seerr').error({ err: error }, 'Stored Seerr user map is invalid');
      return {};
    }
  }

  async function setUserMapping(
    findarrUserId: number,
    seerrUserId: number | null,
  ): Promise<SeerrUserMappings> {
    const { [String(findarrUserId)]: _removed, ...rest } = await getUserMappings();
    const next = seerrUserId === null ? rest : { ...rest, [String(findarrUserId)]: seerrUserId };
    await context.settings.set({ [USER_MAP_KEY]: JSON.stringify(next) });
    return next;
  }

  /**
   * Create a request. findarrUserId selects the Seerr user it is made for;
   * without an assignment Seerr attributes it to the API key's owner.
   */
  async function requestMedia(
    params: Omit<SeerrRequestParams, 'userId'>,
    findarrUserId?: number,
  ): Promise<void> {
    const mappings = await getUserMappings();
    const userId = isDefined(findarrUserId) ? mappings[String(findarrUserId)] : undefined;
    await lifecycle.client().requestMedia({ ...params, userId });
  }

  return {
    getSettings,
    setSettings,
    isConfigured,
    testConnection,
    testAndSync: testConnection,
    listUsers,
    getUserMappings,
    setUserMapping,
    requestMedia,
  };
}

export type SeerrService = Awaited<ReturnType<typeof createSeerrService>>;
