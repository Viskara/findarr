import type { Media } from '@findarr/shared/media';
import { isDefined } from '@findarr/shared/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mdblistService } from '../services/api';
import { isSameMedia, mergeUniqueMedia } from '../utils/media';

interface ListFeedState {
  results: Media[];
  page: number;
  hasMore: boolean;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
}

const emptyState: ListFeedState = {
  results: [],
  page: 0,
  hasMore: false,
  total: 0,
  loading: false,
  loadingMore: false,
  error: false,
};

export function useListFeed(listId: string | undefined) {
  const [state, setState] = useState<ListFeedState>(emptyState);
  const requestIdRef = useRef(0);
  const pageRef = useRef(0);

  const load = useCallback(async (id: string, page: number) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const append = page > 1;

    setState((current) =>
      append ? { ...current, loadingMore: true, error: false } : { ...emptyState, loading: true },
    );

    try {
      const response = await mdblistService.getItems(id, page);
      if (requestIdRef.current !== requestId) {
        return;
      }

      pageRef.current = page;
      setState((current) => ({
        results: append ? mergeUniqueMedia(current.results, response.results) : response.results,
        page,
        hasMore: response.hasMore,
        total: response.total,
        loading: false,
        loadingMore: false,
        error: false,
      }));
    } catch {
      if (requestIdRef.current === requestId) {
        setState((current) => ({ ...current, loading: false, loadingMore: false, error: true }));
      }
    }
  }, []);

  useEffect(() => {
    pageRef.current = 0;
    if (!isDefined(listId)) {
      requestIdRef.current += 1;
      setState(emptyState);
      return;
    }
    void load(listId, 1);
  }, [listId, load]);

  const loadMore = useCallback(() => {
    if (isDefined(listId)) {
      void load(listId, pageRef.current + 1);
    }
  }, [listId, load]);

  const updateItem = useCallback((updated: Media) => {
    setState((current) => ({
      ...current,
      results: current.results.map((item) => (isSameMedia(item, updated) ? updated : item)),
    }));
  }, []);

  return { ...state, loadMore, updateItem };
}
