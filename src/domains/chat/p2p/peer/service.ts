/**
 * Pure helpers over peer/contact search results.
 */

import { type SearchResult } from '../types';

/**
 * Remove the current user's own account from contact search results.
 *
 * A username search resolves against every registered account, so the current
 * user matches their own username — letting them open a chat with themselves.
 * Self-chats are not a supported flow, so the own account is dropped here.
 *
 * `candidateAccountId` and `selfAccountId` are both SS58 strings minted in the
 * same network context, so a string comparison is sufficient.
 */
function excludeSelfFromSearchResults(results: SearchResult[], selfAccountId: string): SearchResult[] {
  return results.filter(result => result.candidateAccountId !== selfAccountId);
}

export const peerSearchService = {
  excludeSelfFromSearchResults,
};
