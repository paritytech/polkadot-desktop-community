import { type ChatMessageContent, type CodecType } from '@novasamatech/host-api';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { memo, useEffect } from 'react';

import { type MessageContent, productChatService, useProductSessions } from '@/domains/chat';
import { type Product, permissionsService } from '@/domains/product';
import { useProductWorker } from '@/aggregates/product-workers';
import { ProductContainerBinding } from '@/widgets/ProductContainerBinding';

type ProductChatMessage = CodecType<typeof ChatMessageContent>;

type ProductWorkerProps = {
  product: Product;
};

function toProductChatMessage(content: MessageContent): ProductChatMessage {
  switch (content.type) {
    case 'text':
      return { tag: 'Text', value: content.text };
    case 'richText':
      return {
        tag: 'RichText',
        value: { text: content.text, media: [] },
      };
    case 'reacted':
      return { tag: 'Reaction', value: { messageId: content.messageId, emoji: content.emoji } };
    case 'reactionRemoved':
      return { tag: 'ReactionRemoved', value: { messageId: content.messageId, emoji: content.emoji } };
    default:
      return { tag: 'Text', value: '' };
  }
}

export const ProductWorker = memo(({ product }: ProductWorkerProps) => {
  const instance = useProductWorker(product);
  const { session } = useSession();
  const { data: chatSessions } = useProductSessions();

  useEffect(() => {
    if (!instance || !session) return;

    const userId = productChatService.getUserId(session);
    const unsubscribers: VoidFunction[] = [];

    for (const chatSession of chatSessions) {
      const chatSessionId = productChatService.getSessionId(product.baseName, chatSession.roomId, userId);
      if (chatSession.sessionId !== chatSessionId) continue;

      const unsub = chatSession.onUserMessage(message => {
        const peer =
          message.peer.type === 'user' || message.peer.type === 'p2p' ? message.peer.accountId : message.peer.productId;
        // After dispose, instance.events.events is cleared, so emit becomes a no-op
        instance.events.emit('sendChatAction', chatSession.roomId, peer, {
          tag: 'MessagePosted',
          value: toProductChatMessage(message.content),
        });
      });
      unsubscribers.push(unsub);
    }

    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  }, [instance, chatSessions, session, product.baseName]);

  if (!instance) return null;
  // Workers have no modality of their own — enforced against 'app' via the domain rule.
  return (
    <ProductContainerBinding
      container={instance.container}
      identifier={product.baseName}
      modality={permissionsService.modalityForKind('worker')}
    />
  );
});
