// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

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

  it('hides the vertical overflow by default and lets the caller style override it', () => {
    const { rerender } = render(<TextArea placeholder="Write a message" />);
    expect(screen.getByRole('textbox')).toHaveClass('overflow-y-hidden');

    rerender(<TextArea placeholder="Write a message" style={{ overflowY: 'auto' }} />);
    expect(screen.getByRole('textbox').style.overflowY).toBe('auto');
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
