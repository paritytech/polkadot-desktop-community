import { type FlatMessages, type TranslationMessages } from './types';

/**
 * Flattens nested translation messages into a flat structure with dot-notation keys
 *
 * @example
 * flattenMessages({
 *   user: {
 *     profile: {
 *       title: 'Profile'
 *     }
 *   }
 * })
 * // Returns: { 'user.profile.title': 'Profile' }
 */
export function flattenMessages(messages: TranslationMessages, prefix = ''): FlatMessages {
  const result: FlatMessages = {};

  for (const [key, value] of Object.entries(messages)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (value && typeof value === 'object') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      Object.assign(result, flattenMessages(value as TranslationMessages, fullKey));
    }
  }

  return result;
}
