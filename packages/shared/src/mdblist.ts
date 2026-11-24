import { z } from 'zod';

import type { Media } from './media.js';

export const MDBLIST_PAGE_SIZE = 20;

export const MdblistAddQuerySchema = z.object({
  url: z.string().trim().min(1).max(500),
  name: z.string().trim().max(100).optional(),
});

export const MdblistListParamsSchema = z.object({
  id: z.string().min(1),
});

export const MdblistItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export type MdblistAddQuery = z.infer<typeof MdblistAddQuerySchema>;
export type MdblistListParams = z.infer<typeof MdblistListParamsSchema>;
export type MdblistItemsQuery = z.infer<typeof MdblistItemsQuerySchema>;

export interface MdblistList {
  id: string;
  url: string;
  name: string;
  itemCount: number;
  movieCount: number;
  showCount: number;
  lastSyncedAt: number | null;
}

export interface MdblistPreviewItem {
  tmdbId: number;
  type: 'movie' | 'tv';
  name: string;
  posterPath: string | null;
}

/** The first few titles of a list, for the overview card. */
export interface MdblistPreview {
  items: MdblistPreviewItem[];
}

export const MDBLIST_PREVIEW_SIZE = 5;

export interface MdblistItemsResponse {
  results: Media[];
  page: number;
  hasMore: boolean;
  total: number;
}
