import SquareDashedIcon from '@/shared/assets/images/icons/square-dashed.svg?jsx';
import { cnTw } from '@/shared/utils';

type Props = {
  // The size of the `AppIcon` tile it sits in.
  size: '24' | '44' | '64';
};

// Figma draws the glyph at a per-tile size rather than a constant fraction of the
// tile, so map the sizes instead of deriving a percentage.
const glyphSizeClass: Record<Props['size'], string> = {
  '24': cnTw('size-4'),
  '44': cnTw('size-7'),
  '64': cnTw('size-12'),
};

// The empty-state glyph `AppIcon` draws when it has no image and no children. Inherits the tile's text colour.
export const AppIconPlaceholder = ({ size }: Props) => {
  return <SquareDashedIcon className={cnTw('shrink-0', glyphSizeClass[size])} />;
};
