import { z } from 'zod';

export const SeerrUserMappingParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

/** `null` clears the assignment, so requests fall back to the API key's owner. */
export const SeerrUserMappingQuerySchema = z.object({
  seerrUserId: z.number().int().positive().nullable(),
});

export type SeerrUserMappingParams = z.infer<typeof SeerrUserMappingParamsSchema>;
export type SeerrUserMappingQuery = z.infer<typeof SeerrUserMappingQuerySchema>;

export interface SeerrUser {
  id: number;
  name: string;
  email: string | null;
}

/** Findarr user id (as string) → Seerr user id. */
export type SeerrUserMappings = Record<string, number>;
