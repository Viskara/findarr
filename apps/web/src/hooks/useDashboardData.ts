import type { MdblistList } from '@findarr/shared/mdblist';
import type { Media } from '@findarr/shared/media';
import { useCallback, useEffect, useRef, useState } from 'react';

import { interactionService, mdblistService, searchService } from '../services/api';
import { useSession } from './useSession';

export interface DashboardData {
  nextMedia: Media | undefined;
  availableResults: Media[];
  requestedResults: Media[];
  lists: MdblistList[];
  loadingRequested: boolean;
  loadingHero: boolean;
  loadingAvailable: boolean;
  heroError: string | undefined;
}

export function useDashboardData(): DashboardData {
  const { user } = useSession();
  const userId = user?.id;
  const [requestedResults, setRequestedResults] = useState<Media[]>([]);
  const [lists, setLists] = useState<MdblistList[]>([]);
  const [loadingRequested, setLoadingRequested] = useState(true);
  const [nextMedia, setNextMedia] = useState<Media | undefined>();
  const [availableResults, setAvailableResults] = useState<Media[]>([]);
  const [loadingHero, setLoadingHero] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [heroError, setHeroError] = useState<string | undefined>();
  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setLoadingHero(true);
    setLoadingAvailable(true);
    setLoadingRequested(true);
    setHeroError(undefined);

    const loadHero = async () => {
      try {
        const result = await searchService.getVotingFeed({ type: 'both' });
        if (requestId !== requestIdRef.current) {
          return;
        }
        setNextMedia(result.results[0]);
        setHeroError(undefined);
      } catch (err) {
        console.error('Failed to load next voting candidate:', err);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setNextMedia(undefined);
        setHeroError('Could not load your next voting pick right now.');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingHero(false);
        }
      }
    };

    const loadAvailable = async () => {
      try {
        const result = await interactionService.listActivity({
          page: 1,
          statuses: ['available'],
          type: 'both',
          action: 'all',
        });
        if (requestId !== requestIdRef.current) {
          return;
        }
        setAvailableResults(result.results);
      } catch (err) {
        console.error('Failed to load newly available media:', err);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setAvailableResults([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingAvailable(false);
        }
      }
    };

    // The user's own requests that are still on their way to the library.
    const loadRequested = async () => {
      try {
        const result = await interactionService.listActivity({
          page: 1,
          action: 'liked',
          statuses: ['requested', 'downloading', 'downloaded', 'warning'],
          type: 'both',
          ...(userId === undefined ? {} : { userId }),
        });
        if (requestId === requestIdRef.current) {
          setRequestedResults(result.results);
        }
      } catch (err) {
        console.error('Failed to load requests in progress:', err);
        if (requestId === requestIdRef.current) {
          setRequestedResults([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingRequested(false);
        }
      }
    };

    const loadLists = async () => {
      try {
        const loaded = await mdblistService.listLists();
        if (requestId === requestIdRef.current) {
          setLists(loaded);
        }
      } catch (err) {
        console.error('Failed to load lists:', err);
      }
    };

    void loadHero();
    void loadAvailable();
    void loadRequested();
    void loadLists();
  }, [userId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    nextMedia,
    availableResults,
    requestedResults,
    lists,
    loadingRequested,
    loadingHero,
    loadingAvailable,
    heroError,
  };
}
