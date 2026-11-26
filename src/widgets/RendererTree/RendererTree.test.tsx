// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { act, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RendererTree } from './RendererTree';
import { type RenderSink, type RendererTreeNode } from './types';

// The widget subscribes only while on screen; jsdom/happy-dom report no
// intersections, so drive the observer directly.
vi.mock(import('@/shared/hooks'), async importOriginal => {
  const actual = await importOriginal();

  return {
    ...actual,
    useIntersectionObserver: (_ref: unknown, callback: (entry: IntersectionObserverEntry) => void) => {
      // Once, in an effect — calling it during render would re-enter setState on every
      // pass and blow the render limit.
      useEffect(() => {
        callback({ isIntersecting: true } as IntersectionObserverEntry);
      }, [callback]);
    },
  };
});

const textTree = (text: string): RendererTreeNode => ({ tag: 'String', value: { text } });

function renderWithSink() {
  // A holder, not a `let`: TypeScript narrows a closure-assigned local back to its
  // initializer here and the null check below would leave it `never`.
  const holder: { current: Nullable<RenderSink> } = { current: null };
  const teardown = vi.fn();

  const view = render(
    <RendererTree
      productId="demo.dot"
      subscribe={next => {
        holder.current = next;

        return teardown;
      }}
      onAction={vi.fn()}
    />,
  );

  const sink = holder.current;
  if (!sink) throw new Error('subscribe was never called');

  return { sink, teardown, unmount: view.unmount };
}

describe('RendererTree', () => {
  it('draws the tree the product pushes', () => {
    const { sink } = renderWithSink();

    act(() => sink.onNode(textTree('hello')));

    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('draws a labelled text field and a button as host controls', () => {
    const { sink } = renderWithSink();

    act(() =>
      sink.onNode({
        tag: 'Column',
        value: {
          modifiers: [],
          props: {},
          children: [
            {
              tag: 'TextField',
              value: { modifiers: [], props: { text: 'draft', label: 'Amount' } },
            },
            {
              tag: 'Button',
              value: { modifiers: [], props: { text: 'Send' }, children: [] },
            },
          ],
        },
      }),
    );

    expect(screen.getByLabelText('Amount')).toHaveValue('draft');
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('replaces the tree on each update rather than patching', () => {
    const { sink } = renderWithSink();

    act(() => sink.onNode(textTree('first')));
    act(() => sink.onNode(textTree('second')));

    expect(screen.queryByText('first')).not.toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  // The contract that matters: a product that fails halfway must not leave what it
  // managed to draw on screen, where it reads as its finished output.
  it('drops the partial tree when the render fails', () => {
    const { sink } = renderWithSink();

    act(() => sink.onNode(textTree('half a message')));
    expect(screen.getByText('half a message')).toBeInTheDocument();

    act(() => sink.onError());

    expect(screen.queryByText('half a message')).not.toBeInTheDocument();
  });

  // A live tree is work the product's worker is doing; a message scrolled off or a
  // list unmounted has to stop paying for it.
  it('tears the subscription down on unmount', () => {
    const { teardown, unmount } = renderWithSink();

    expect(teardown).not.toHaveBeenCalled();

    act(() => unmount());

    expect(teardown).toHaveBeenCalledTimes(1);
  });
});
