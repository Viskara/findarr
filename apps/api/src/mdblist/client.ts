import { create } from 'axios';
import { z } from 'zod';

import { badRequest } from '../utils/errors.js';

export interface MdblistRef {
  username: string;
  slug: string;
}

export interface MdblistItem {
  tmdbId: number;
  type: 'movie' | 'tv';
}

const SEGMENT_PATTERN = /^[\w.-]+$/u;

const ItemSchema = z.object({
  id: z.number().int().positive(),
  mediatype: z.enum(['movie', 'show']),
});

const http = create({
  baseURL: 'https://mdblist.com',
  timeout: 30_000,
  headers: { Accept: 'application/json', 'User-Agent': 'Findarr' },
});

/**
 * Accepts https://mdblist.com/lists/{username}/{slug} (any trailing path/query)
 * and rebuilds the request URL from the validated segments only, so the
 * outgoing host is always mdblist.com.
 */
export function parseMdblistUrl(input: string): MdblistRef {
  let url: URL;
  try {
    url = new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    throw badRequest('Invalid MDBList URL');
  }

  const [section, username, slug] = url.pathname.split('/').filter(Boolean);
  const isMdblistHost = url.hostname === 'mdblist.com' || url.hostname === 'www.mdblist.com';

  if (
    !isMdblistHost ||
    section !== 'lists' ||
    username === undefined ||
    slug === undefined ||
    !SEGMENT_PATTERN.test(username) ||
    !SEGMENT_PATTERN.test(slug)
  ) {
    throw badRequest('Expected a URL like https://mdblist.com/lists/username/list-name');
  }

  return { username, slug };
}

export function mdblistPublicUrl({ username, slug }: MdblistRef): string {
  return `https://mdblist.com/lists/${username}/${slug}`;
}

export function defaultListName({ slug }: MdblistRef): string {
  return slug
    .split(/[-_]+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Fetch every item of a public MDBList list. The ids MDBList returns are TMDB ids.
 */
export async function fetchMdblistItems({ username, slug }: MdblistRef): Promise<MdblistItem[]> {
  const response = await http.get<unknown>(`/lists/${username}/${slug}/json`);

  if (!Array.isArray(response.data)) {
    throw badRequest('MDBList returned an unexpected response (is the list public?)');
  }

  const seen = new Set<string>();
  const items: MdblistItem[] = [];

  for (const raw of response.data) {
    const parsed = ItemSchema.safeParse(raw);
    if (!parsed.success) {
      continue;
    }

    const type = parsed.data.mediatype === 'show' ? 'tv' : 'movie';
    const key = `${type}:${parsed.data.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ tmdbId: parsed.data.id, type });
    }
  }

  return items;
}
