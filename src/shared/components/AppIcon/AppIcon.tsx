import { type ReactNode, useState } from 'react';

import { cnTw } from '@/shared/utils';
import { AppIconPlaceholder } from '../AppIconPlaceholder/AppIconPlaceholder';

type Props = {
  size: '24' | '44' | '64';
  src?: string;
  alt?: string;
  children?: ReactNode;
};

/** An app's icon tile: the image when it loads, else the children, else the placeholder glyph. */
export const AppIcon = ({ size, src, alt = '', children }: Props) => {
  const [failedSrc, setFailedSrc] = useState<string>();
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      data-slot="app-icon"
      className={cnTw(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
        size === '24' && 'size-6 rounded-md',
        size === '44' && 'size-11 rounded-lg',
        size === '64' && 'size-16 rounded-xl',
        !showImage && 'bg-chrome-fill text-chrome-text shadow-chrome-ring',
      )}
    >
      {showImage ? (
        <img src={src} alt={alt} draggable={false} className="size-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        (children ?? <AppIconPlaceholder size={size} />)
      )}
    </span>
  );
};
