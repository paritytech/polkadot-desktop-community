import { ArrowDownLeft, ArrowUpRight, Phone, Video } from 'lucide-react';
import { type MouseEvent } from 'react';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type CallSignalContent, type ChatMessage } from '@/domains/chat';
import { type CallState, formatCallDuration } from '../helpers/callState';
import { formatMessageDate } from '../helpers/message';

import { StatusIcon } from './MessageBubble';

type Props = {
  message: ChatMessage;
  content: CallSignalContent;
  state: CallState;
  isMe: boolean;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
};

export const CallMessageBubble = ({ message, content, state, isMe, onContextMenu }: Props) => {
  const { t } = useTranslation();
  const isVideo = content.purpose === 'video';

  const title = titleFor(state, isMe, isVideo, t);
  const subtitle = subtitleFor(state, isMe, t);
  const isMissedOrDeclined = state.kind === 'missed';

  const CallIcon = isVideo ? Video : Phone;
  const StatusArrow = isMissedOrDeclined ? ArrowDownLeft : ArrowUpRight;
  const statusArrowColor = isMissedOrDeclined ? 'text-fg-error' : 'text-fg-success';

  return (
    <div
      className={cnTw(
        'flex flex-col items-start rounded-2xl',
        isMe ? 'bg-bg-surface-container-inverted' : 'bg-bg-surface-nested',
      )}
      onContextMenu={onContextMenu}
    >
      <div className="flex w-full items-end justify-between gap-2 pt-1.5 pr-2 pb-1.5 pl-3">
        <div className="flex items-center gap-2 py-0.5 pr-2">
          <div
            className={cnTw(
              'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full',
              isMe ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container',
            )}
          >
            <CallIcon className={cnTw('size-5', isMe ? 'text-fg-primary-inverted' : 'text-fg-primary')} />
          </div>
          <div className="flex flex-col items-start justify-center">
            <p className={cnTw('text-base leading-5 whitespace-nowrap', isMe ? 'text-fg-primary-inverted' : 'text-fg-primary')}>
              {title}
            </p>
            <div className="flex items-center gap-0.5">
              <StatusArrow className={cnTw('size-4 shrink-0', statusArrowColor)} />
              <p
                className={cnTw(
                  'text-xs leading-4 font-medium whitespace-nowrap',
                  isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary',
                )}
              >
                {subtitle}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-0.5 self-end">
          <span
            className={cnTw(
              'text-xs leading-4 font-medium whitespace-nowrap',
              isMe ? 'text-fg-secondary-inverted' : 'text-fg-tertiary',
            )}
          >
            {formatMessageDate(message.timestamp)}
          </span>
          {isMe && (
            <div className="flex size-3 items-center justify-center">
              <StatusIcon status={message.status} className={cnTw('size-3', 'text-fg-secondary-inverted')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type Translate = ReturnType<typeof useTranslation>['t'];

function titleFor(state: CallState, isMe: boolean, isVideo: boolean, t: Translate): string {
  switch (state.kind) {
    case 'calling':
      if (isMe) return isVideo ? t('feature.chat.call.title.outgoingVideo') : t('feature.chat.call.title.outgoingVoice');
      return isVideo ? t('feature.chat.call.title.incomingVideo') : t('feature.chat.call.title.incomingVoice');
    case 'active':
      return isVideo ? t('feature.chat.call.title.ongoingVideo') : t('feature.chat.call.title.ongoingVoice');
    case 'finished':
      return isVideo ? t('feature.chat.call.title.video') : t('feature.chat.call.title.voice');
    case 'missed':
      return isVideo ? t('feature.chat.call.title.missedVideo') : t('feature.chat.call.title.missedVoice');
    case 'cancelled':
      return isVideo ? t('feature.chat.call.title.canceledVideo') : t('feature.chat.call.title.canceledVoice');
  }
}

function subtitleFor(state: CallState, isMe: boolean, t: Translate): string {
  switch (state.kind) {
    case 'calling':
      return t('feature.chat.call.subtitle.openToCall');
    case 'active':
      return t('feature.chat.call.subtitle.openToReturn');
    case 'finished':
      return formatCallDuration(state.durationMs);
    case 'missed':
      return t('feature.chat.call.subtitle.openToCallBack');
    case 'cancelled':
      // Figma uses "again" for outgoing cancellations vs "back" when the contact cancelled.
      return isMe ? t('feature.chat.call.subtitle.openToCallAgain') : t('feature.chat.call.subtitle.openToCallBack');
  }
}
