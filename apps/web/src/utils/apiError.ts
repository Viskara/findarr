import { getErrorMessage } from '@findarr/shared/utils';
import { isAxiosError } from 'axios';

/**
 * Prefer the message the API sent ({ error: string }) over axios' generic
 * "Request failed with status code 400".
 */
export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const { error: message } = data;
      if (typeof message === 'string' && message !== '') {
        return message;
      }
    }
  }
  return getErrorMessage(error);
}
