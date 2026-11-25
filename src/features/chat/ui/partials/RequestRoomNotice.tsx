import { type ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';

export const boldName = (chunks: ReactNode) => <span className="font-semibold text-fg-primary">{chunks}</span>;

type RequestRoomNoticeProps = {
  textId: string;
  name: string;
};

export const RequestRoomNotice = ({ textId, name }: RequestRoomNoticeProps) => {
  return (
    <div className="shrink-0 border-t border-stroke-primary px-4 py-3">
      <p className="text-sm leading-4.5 text-fg-secondary">
        <FormattedMessage id={textId} values={{ name, b: boldName }} />
      </p>
    </div>
  );
};
