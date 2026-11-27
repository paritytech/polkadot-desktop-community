import { type FC, type PropsWithChildren } from 'react';

type Props = {
  testId: string;
};

export const ChainList: FC<PropsWithChildren<Props>> = ({ testId, children }) => (
  <div
    data-testid={testId}
    className="flex flex-col rounded-xl bg-chrome-well px-3 text-start text-chrome-text shadow-chrome-inset"
  >
    {children}
  </div>
);
