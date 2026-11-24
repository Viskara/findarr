import type { LibSettings, LibSettingsQuery } from '@findarr/shared/settings';
import { isDefined } from '@findarr/shared/utils';

import type { SettingsService } from '../settings/service.js';
import { createClientLifecycle } from '../utils/clientLifecycleHelper.js';
import { trimTrailingSlash } from '../utils/links.js';
import type { AppLogger } from '../utils/logger.js';
import { createSeerrClient, type SeerrClient, type SeerrRequestParams } from './client.js';

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

  async function requestMedia(params: SeerrRequestParams): Promise<void> {
    await lifecycle.client().requestMedia(params);
  }

  return {
    getSettings,
    setSettings,
    isConfigured,
    testConnection,
    testAndSync: testConnection,
    requestMedia,
  };
}

export type SeerrService = Awaited<ReturnType<typeof createSeerrService>>;
