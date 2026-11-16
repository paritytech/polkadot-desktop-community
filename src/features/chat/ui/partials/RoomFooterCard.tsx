import { type RenderContext } from '@parity/truapi';
import { useMemo } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { type RoomFooter } from '@/domains/chat';

import { ProductRenderedBody } from './ProductRenderedBody';

type Props = {
  roomId: string;
  footer: Extract<RoomFooter, { type: 'card' }>;
};

export const RoomFooterCard = ({ roomId, footer }: Props) => {
  const context = useMemo<RenderContext>(
    () => ({ tag: 'ChatRoomFooter', value: { roomId, messageType: footer.messageType } }),
    [roomId, footer.messageType],
  );

  return (
    <div data-testid={TEST_IDS.chatRoomFooterCard}>
      <ProductRenderedBody productId={footer.productId} context={context} payload={footer.payload} />
    </div>
  );
};
