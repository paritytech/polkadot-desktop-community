import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { useUserProductRooms } from '@/domains/chat';
import { resolveProductUseCase } from '@/domains/product';

import { pickProductSurface } from './pickProductSurface';

// Opens a product's primary interactable surface. The dashboard renders an icon
// for any committed product (existence is enough); the executables needed to
// decide *what* opening means are fetched lazily here, on press.
export const useOpenProductSurface = () => {
  const navigate = useNavigate();
  const { data: rooms } = useUserProductRooms();

  return useCallback(
    async (productId: string) => {
      const resolved = await resolveProductUseCase.resolveProduct(productId);
      if (!resolved) return;

      const firstRoom = rooms.find(room => room.productId === resolved.baseName) ?? null;
      const surface = pickProductSurface(resolved.executables, firstRoom);

      switch (surface.kind) {
        case 'app':
          navigate({ to: '/product/$id/{-$route}', params: { id: resolved.baseName } });
          break;
        case 'chat':
          navigate({ to: '/chat/{-$chatId}', params: { chatId: surface.sessionId } });
          break;
        case 'none':
          break;
      }
    },
    [navigate, rooms],
  );
};
