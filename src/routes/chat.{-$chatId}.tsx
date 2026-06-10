import { createFileRoute } from '@tanstack/react-router';

import { ChatFullscreen } from '@/features/chat';

export const Route = createFileRoute('/chat/{-$chatId}')({
  component: () => {
    const { chatId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <ChatFullscreen
        selected={chatId ?? null}
        onSelect={chatId => navigate({ to: `/chat/{-$chatId}`, params: { chatId } })}
        onDeselect={() => navigate({ to: '/chat/{-$chatId}', params: { chatId: undefined } })}
      />
    );
  },
});
