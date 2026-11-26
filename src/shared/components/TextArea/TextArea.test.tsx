// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TextArea } from './TextArea';

describe('TextArea', () => {
  it('renders a textbox with the caller placeholder and attributes', () => {
    render(<TextArea data-testid="composer" placeholder="Write a message" />);

    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toBe(screen.getByTestId('composer'));
    expect(textarea).toHaveAttribute('placeholder', 'Write a message');
    expect(textarea).toHaveAttribute('rows', '1');
    expect(textarea).toHaveAttribute('data-no-app-focus');
    expect(textarea.style.getPropertyValue('app-region')).toBe('no-drag');
  });

  it('forwards the ref to the textarea', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<TextArea ref={ref} placeholder="Write a message" />);

    expect(ref.current).toBe(screen.getByRole('textbox'));
  });

  it('calls a callback ref with the textarea', () => {
    const ref = vi.fn();
    render(<TextArea ref={ref} placeholder="Write a message" />);

    expect(ref).toHaveBeenLastCalledWith(screen.getByRole('textbox'));
  });

  it('renders the header above the textarea and the trailing content after it', () => {
    render(
      <TextArea
        header={<div data-testid="reply">Replying</div>}
        placeholder="Write a message"
        trailing={<button type="button">Send</button>}
      />,
    );

    const textarea = screen.getByRole('textbox');
    const header = screen.getByTestId('reply');
    const send = screen.getByRole('button', { name: 'Send' });
    expect(textarea.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(textarea.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe('growth', () => {
    // happy-dom has no layout: the content height is stubbed on the element, and the line height is set inline so the
    // computed style the component reads holds a length.
    const stubContentHeight = (field: HTMLElement, height: () => number) =>
      Object.defineProperty(field, 'scrollHeight', { configurable: true, get: height });

    it('grows with a controlled value up to the default five rows, then scrolls', () => {
      let contentHeight = 40;
      const { rerender } = render(<TextArea value="two" style={{ lineHeight: '20px' }} onChange={() => {}} />);
      const field = screen.getByRole('textbox');
      stubContentHeight(field, () => contentHeight);

      rerender(<TextArea value="two lines" style={{ lineHeight: '20px' }} onChange={() => {}} />);
      expect(field.style.height).toBe('40px');
      expect(field.style.overflowY).toBe('hidden');

      contentHeight = 120;
      rerender(<TextArea value="six lines" style={{ lineHeight: '20px' }} onChange={() => {}} />);
      expect(field.style.height).toBe('100px');
      expect(field.style.overflowY).toBe('auto');
    });

    it('caps an uncontrolled field at maxRows on input', () => {
      const onInput = vi.fn();
      render(<TextArea maxRows={2} style={{ lineHeight: '20px' }} onInput={onInput} />);
      const field = screen.getByRole('textbox');

      stubContentHeight(field, () => 20);
      fireEvent.input(field, { target: { value: 'one' } });
      expect(field.style.height).toBe('20px');
      expect(field.style.overflowY).toBe('hidden');

      stubContentHeight(field, () => 60);
      fireEvent.input(field, { target: { value: 'one\ntwo\nthree' } });
      expect(field.style.height).toBe('40px');
      expect(field.style.overflowY).toBe('auto');
      expect(onInput).toHaveBeenCalledTimes(2);
    });
  });

  it('focuses the textarea on a press on the row padding', () => {
    render(<TextArea placeholder="Write a message" />);
    const textarea = screen.getByRole('textbox');
    const row = textarea.parentElement!.parentElement!;

    expect(fireEvent.mouseDown(row)).toBe(false);
    expect(textarea).toHaveFocus();
  });

  it('leaves a press on the header or the trailing content to that content', () => {
    render(
      <TextArea
        header={<div data-testid="reply">Replying</div>}
        placeholder="Write a message"
        trailing={<button type="button">Send</button>}
      />,
    );

    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Send' }))).toBe(true);
    expect(fireEvent.mouseDown(screen.getByTestId('reply'))).toBe(true);
    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });

  it('passes disabled to the textarea', () => {
    render(<TextArea disabled placeholder="Write a message" />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
