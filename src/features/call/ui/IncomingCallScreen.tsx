import { type ReactNode } from 'react';

import { Avatar } from '@/shared/components';

import { CallControlButton } from './CallControlButton';

type IncomingCallScreenProps = {
  name: string;
  callTypeLabel: string;
  acceptLabel: string;
  declineLabel: string;
  acceptIcon: ReactNode;
  declineIcon: ReactNode;
  onAccept: VoidFunction;
  onDecline: VoidFunction;
};

export const IncomingCallScreen = ({
  name,
  callTypeLabel,
  acceptLabel,
  declineLabel,
  acceptIcon,
  declineIcon,
  onAccept,
  onDecline,
}: IncomingCallScreenProps) => (
  <div className="flex h-full w-full flex-col items-center justify-between bg-neutral-900 p-8 text-white">
    <div className="mt-8 flex flex-col items-center gap-3">
      <span className="text-sm text-white/70">{callTypeLabel}</span>
      <span className="text-2xl font-bold">{name}</span>
      <Avatar label={name} size="96" />
    </div>

    <div className="mb-8 flex items-center justify-center gap-16">
      <CallControlButton label={declineLabel} tone="decline" icon={declineIcon} onPress={onDecline} />
      <CallControlButton label={acceptLabel} tone="accept" icon={acceptIcon} onPress={onAccept} />
    </div>
  </div>
);
