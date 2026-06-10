// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, levelToPercent, webviewZoom } from './levels';

const PRODUCT = 'app.dot';

beforeEach(() => {
  webviewZoom.levels$.set({});
});

describe('webviewZoom state', () => {
  it('starts with no levels', () => {
    expect(webviewZoom.levels$.get()).toEqual({});
  });

  it('zoomIn() increments the level from the 0 default', () => {
    webviewZoom.zoomIn(PRODUCT);
    expect(webviewZoom.levels$.get()[PRODUCT]).toBe(1);
  });

  it('zoomOut() decrements the level from the 0 default', () => {
    webviewZoom.zoomOut(PRODUCT);
    expect(webviewZoom.levels$.get()[PRODUCT]).toBe(-1);
  });

  it('reset() returns the level to 0', () => {
    webviewZoom.zoomIn(PRODUCT);
    webviewZoom.zoomIn(PRODUCT);
    webviewZoom.reset(PRODUCT);
    expect(webviewZoom.levels$.get()[PRODUCT]).toBe(0);
  });

  it('clamps at MAX_ZOOM_LEVEL', () => {
    for (let i = 0; i < MAX_ZOOM_LEVEL + 5; i++) webviewZoom.zoomIn(PRODUCT);
    expect(webviewZoom.levels$.get()[PRODUCT]).toBe(MAX_ZOOM_LEVEL);
  });

  it('clamps at MIN_ZOOM_LEVEL', () => {
    for (let i = 0; i < -MIN_ZOOM_LEVEL + 5; i++) webviewZoom.zoomOut(PRODUCT);
    expect(webviewZoom.levels$.get()[PRODUCT]).toBe(MIN_ZOOM_LEVEL);
  });

  it('does not emit a new state when the clamped level is unchanged (zoom at a limit)', () => {
    for (let i = 0; i < MAX_ZOOM_LEVEL; i++) webviewZoom.zoomIn(PRODUCT);
    const atLimit = webviewZoom.levels$.get();
    webviewZoom.zoomIn(PRODUCT); // already at MAX → no-op
    expect(webviewZoom.levels$.get()).toBe(atLimit); // same reference, no emission
  });

  it('reset() on an already-100% product is a no-op', () => {
    const initial = webviewZoom.levels$.get();
    webviewZoom.reset(PRODUCT);
    expect(webviewZoom.levels$.get()).toBe(initial);
  });

  it('levelToPercent() converts level units to rounded percentages', () => {
    expect(levelToPercent(0)).toBe(100);
    expect(levelToPercent(1)).toBe(120);
    expect(levelToPercent(-1)).toBe(83);
  });

  it('keeps levels independent per product', () => {
    webviewZoom.zoomIn('a');
    webviewZoom.zoomOut('b');
    expect(webviewZoom.levels$.get()['a']).toBe(1);
    expect(webviewZoom.levels$.get()['b']).toBe(-1);
  });
});
