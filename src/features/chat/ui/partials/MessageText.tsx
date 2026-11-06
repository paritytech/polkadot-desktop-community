import { type KeyboardEvent, useMemo } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { type DotNsUrl, useDotNsTld } from '@/domains/product';
import { openDotNsUrlSideEffect } from '@/features/browser';
import { chatService } from '../../service';

type MessageTextProps = {
  text: string;
};

/**
 * A message body with its links made clickable: a product opens in Desktop, any
 * other https URL in the system browser.
 */
export const MessageText = ({ text }: MessageTextProps) => {
  const { data: tld, pending, error } = useDotNsTld();
  // Under the unsettled default suffix a `.paseo.li` invitation would classify as
  // an external link, and a click would send it to the system browser.
  const isTldSettled = !pending && !error;

  const segments = useMemo(() => (isTldSettled ? chatService.toMessageSegments(text, tld) : null), [isTldSettled, text, tld]);

  if (!segments) return text;

  return segments.map((segment, index) => {
    switch (segment.type) {
      case 'text':
        return segment.text;
      case 'product':
        // eslint-disable-next-line react/no-array-index-key -- positional segments of one static string
        return <ProductLink key={index} text={segment.text} target={segment.target} />;
      case 'external':
        return (
          <a
            // eslint-disable-next-line react/no-array-index-key -- positional segments of one static string
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={TEST_IDS.chatMessageLink}
            className="cursor-pointer underline underline-offset-2"
          >
            {segment.text}
          </a>
        );
    }
  });
};

type ProductLinkProps = {
  text: string;
  target: DotNsUrl;
};

// A span, not an anchor or a button: a bare name has no absolute URL for an href,
// a middle-click on an anchor would bypass the handler and reach main's external
// path, and a button lays out as inline-block, so a long invite URL could not wrap
// with the surrounding text.
const ProductLink = ({ text, target }: ProductLinkProps) => {
  const open = () => {
    void openDotNsUrlSideEffect.apply(target);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter') open();
  };

  return (
    <span
      role="link"
      tabIndex={0}
      data-testid={TEST_IDS.chatMessageLink}
      className="cursor-pointer underline underline-offset-2"
      onClick={open}
      onKeyDown={handleKeyDown}
    >
      {text}
    </span>
  );
};
