import { beforeEach, describe, expect, it } from 'vitest';

import { findInPage } from './sessions';

const TAB = 'app.dot';

beforeEach(() => {
  for (const id of Object.keys(findInPage.sessions$.get())) findInPage.clear(id);
});

describe('findInPage state', () => {
  it('starts with no sessions', () => {
    expect(findInPage.sessions$.get()).toEqual({});
    expect(findInPage.requests$.get()).toEqual({});
  });

  it('open() makes the session visible without a query', () => {
    findInPage.open(TAB);
    expect(findInPage.sessions$.get()[TAB]).toMatchObject({ visible: true, query: '', matches: 0, activeMatchOrdinal: 0 });
    // Nothing to search yet, so no request is dispatched.
    expect(findInPage.requests$.get()[TAB]).toBeUndefined();
  });

  it('open() bumps openSeq on every call so the overlay can re-focus on re-press', () => {
    findInPage.open(TAB);
    const first = findInPage.sessions$.get()[TAB]!.openSeq;
    findInPage.open(TAB);
    const second = findInPage.sessions$.get()[TAB]!.openSeq;
    findInPage.open(TAB);
    const third = findInPage.sessions$.get()[TAB]!.openSeq;
    expect(second).toBe(first + 1);
    expect(third).toBe(second + 1);
  });

  it('setQuery() stores the query and dispatches a search request', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    expect(findInPage.sessions$.get()[TAB]?.query).toBe('hello');
    expect(findInPage.requests$.get()[TAB]).toMatchObject({ query: 'hello', mode: 'search' });
  });

  it('increments the request seq on every dispatch', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'a');
    const first = findInPage.requests$.get()[TAB]!.seq;
    findInPage.setQuery(TAB, 'ab');
    expect(findInPage.requests$.get()[TAB]!.seq).toBe(first + 1);
  });

  it('setQuery("") clears matches and dispatches stop', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.reportResult(TAB, { matches: 3, activeMatchOrdinal: 1 });
    findInPage.setQuery(TAB, '');
    expect(findInPage.sessions$.get()[TAB]).toMatchObject({ query: '', matches: 0, activeMatchOrdinal: 0 });
    expect(findInPage.requests$.get()[TAB]?.mode).toBe('stop');
  });

  it('reportResult() updates the match counters', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.reportResult(TAB, { matches: 12, activeMatchOrdinal: 3 });
    expect(findInPage.sessions$.get()[TAB]).toMatchObject({ matches: 12, activeMatchOrdinal: 3 });
  });

  it('stepNext()/stepPrev() dispatch directional requests only when a query exists and the bar is open', () => {
    findInPage.stepNext(TAB);
    expect(findInPage.requests$.get()[TAB]).toBeUndefined();

    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.stepNext(TAB);
    expect(findInPage.requests$.get()[TAB]?.mode).toBe('next');
    findInPage.stepPrev(TAB);
    expect(findInPage.requests$.get()[TAB]?.mode).toBe('prev');
  });

  it('stepNext()/stepPrev() are no-ops while the bar is closed, even when a query was set earlier', () => {
    // Regression for the Cmd+G-while-closed bug: pressing Find Next after
    // dismissing the bar would otherwise repaint highlights on a page with no
    // overlay visible.
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.close(TAB);
    const seqAfterClose = findInPage.requests$.get()[TAB]!.seq;
    expect(findInPage.requests$.get()[TAB]?.mode).toBe('stop');

    findInPage.stepNext(TAB);
    findInPage.stepPrev(TAB);

    const after = findInPage.requests$.get()[TAB]!;
    expect(after.seq).toBe(seqAfterClose);
    expect(after.mode).toBe('stop');
  });

  it('close() hides the session and dispatches stop', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.close(TAB);
    expect(findInPage.sessions$.get()[TAB]?.visible).toBe(false);
    expect(findInPage.requests$.get()[TAB]?.mode).toBe('stop');
  });

  it('re-opening a closed session with an existing query re-runs the search', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.close(TAB);
    const seqAfterClose = findInPage.requests$.get()[TAB]!.seq;
    findInPage.open(TAB);
    expect(findInPage.sessions$.get()[TAB]?.visible).toBe(true);
    expect(findInPage.requests$.get()[TAB]).toMatchObject({ query: 'hello', mode: 'search' });
    expect(findInPage.requests$.get()[TAB]!.seq).toBe(seqAfterClose + 1);
  });

  it('rehighlight() re-runs the active search and zeroes counts when the bar is open', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.reportResult(TAB, { matches: 3, activeMatchOrdinal: 1 });
    const seqBefore = findInPage.requests$.get()[TAB]!.seq;
    findInPage.rehighlight(TAB);
    expect(findInPage.sessions$.get()[TAB]).toMatchObject({ matches: 0, activeMatchOrdinal: 0 });
    expect(findInPage.requests$.get()[TAB]).toMatchObject({ query: 'hello', mode: 'search' });
    expect(findInPage.requests$.get()[TAB]!.seq).toBe(seqBefore + 1);
  });

  it('rehighlight() is a no-op when the bar is closed', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.close(TAB);
    const seqBefore = findInPage.requests$.get()[TAB]!.seq;
    findInPage.rehighlight(TAB);
    expect(findInPage.requests$.get()[TAB]!.seq).toBe(seqBefore);
  });

  it('rehighlight() with no query only resets counts', () => {
    findInPage.open(TAB);
    findInPage.reportResult(TAB, { matches: 5, activeMatchOrdinal: 2 });
    findInPage.rehighlight(TAB);
    expect(findInPage.sessions$.get()[TAB]).toMatchObject({ query: '', matches: 0, activeMatchOrdinal: 0 });
    // No query to search, so no request is dispatched.
    expect(findInPage.requests$.get()[TAB]).toBeUndefined();
  });

  it('clear() removes the session and its request', () => {
    findInPage.open(TAB);
    findInPage.setQuery(TAB, 'hello');
    findInPage.clear(TAB);
    expect(findInPage.sessions$.get()[TAB]).toBeUndefined();
    expect(findInPage.requests$.get()[TAB]).toBeUndefined();
  });

  it('keeps sessions independent per tab', () => {
    findInPage.open('a');
    findInPage.setQuery('a', 'foo');
    findInPage.open('b');
    findInPage.setQuery('b', 'bar');
    expect(findInPage.sessions$.get()['a']?.query).toBe('foo');
    expect(findInPage.sessions$.get()['b']?.query).toBe('bar');
  });
});
