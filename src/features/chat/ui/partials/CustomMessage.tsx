import { type CodecType, type CustomRendererNode } from '@novasamatech/host-api';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntersectionObserver } from '@/shared/hooks';
import { type ActionHandler, chatCustomRendererService } from '@/domains/chat';
import { useProductWorkerInstance } from '@/aggregates/product-workers';

type Props = {
  productId: string;
  messageId: string;
  messageType: string;
  payload: Uint8Array;
  roomId: string;
};

export const CustomMessage = ({ productId, messageId, messageType, payload, roomId }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onActionRef = useRef<ActionHandler | null>(null);
  const [node, setNode] = useState<CodecType<typeof CustomRendererNode> | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const instance = useProductWorkerInstance(productId);

  useIntersectionObserver(containerRef, entry => {
    setIsVisible(entry.isIntersecting);
  });

  useEffect(() => {
    if (!isVisible || !instance) return;

    onActionRef.current = (actionId, value) => {
      // events.emit is a no-op after dispose (events.events is cleared first).
      instance.events.emit('sendChatAction', roomId, productId, {
        tag: 'ActionTriggered',
        value: { messageId, actionId, payload: value },
      });
    };

    const subscription = instance.container.renderChatCustomMessage({ messageId, messageType, payload }, setNode);

    return () => subscription.unsubscribe();
  }, [isVisible, instance, productId, roomId, messageId, messageType, payload]);

  const onAction = useCallback<ActionHandler>((actionId, value) => onActionRef.current?.(actionId, value), []);

  return <div ref={containerRef}>{node && chatCustomRendererService.renderNode(node, onAction)}</div>;
};
