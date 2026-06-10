export type FindSession = {
  /** Whether the find bar is open for this tab. */
  visible: boolean;
  /** The current search term. */
  query: string;
  /** Total number of matches reported by the webview. */
  matches: number;
  /** 1-based ordinal of the currently highlighted match (0 when none). */
  activeMatchOrdinal: number;
  /**
   * Monotonic counter bumped on every `open()` — including when the bar is already
   * visible. The overlay subscribes to it so a re-press of Cmd+F re-runs focus/select
   * even though `visible: true → true` would otherwise look like a no-op change.
   */
  openSeq: number;
};

export type FindRequestMode = 'search' | 'next' | 'prev' | 'stop';

/**
 * A command the executor (the Webview widget) consumes. `seq` increments on every
 * dispatch so the executor re-runs even when query/mode are unchanged (e.g. the
 * user steps to the next match twice).
 */
export type FindRequest = {
  query: string;
  mode: FindRequestMode;
  seq: number;
};
