import { X } from 'lucide-react';
import { type MouseEvent } from 'react';

import { useRxState } from '@/shared/rxstate';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct } from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';
import { openDotNsUrlSideEffect } from '../di';
import { recents } from '../state/recents';

type RowProps = { identifier: string };

const RecentRow = ({ identifier }: RowProps) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(identifier);

  const name = product?.displayName ?? identifier;

  const handleOpen = () => {
    void openDotNsUrlSideEffect.apply({ identifier, pathname: '' });
  };

  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation();
    recents.removeRecent(identifier);
  };

  return (
    <li className="group flex items-center gap-1.5 rounded-lg p-2 hover:bg-bg-selection-container-hover">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
        onMouseDown={e => e.preventDefault()}
        onClick={handleOpen}
      >
        <div className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded">
          <ProductIcon icon={product?.icon ?? null} className="size-5 rounded" />
        </div>
        <span className="truncate font-medium text-text-primary">{name}</span>
        <span className="min-w-0 flex-1 truncate text-text-secondary">{identifier}</span>
      </button>
      <button
        type="button"
        aria-label={t('common.aria.close')}
        tabIndex={-1}
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-text-secondary opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-foreground/10 hover:text-text-primary"
        onMouseDown={e => e.preventDefault()}
        onClick={handleRemove}
      >
        <X className="size-4" />
      </button>
    </li>
  );
};

export const RecentsList = () => {
  const { t } = useTranslation();
  const [list] = useRxState(recents.recent$);

  if (list.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-6 items-center pl-2">
        <span className="text-xs leading-4 font-medium text-text-secondary">{t('feature.browser.recents.header')}</span>
      </div>
      <ul className="flex flex-col gap-0">
        {list.map(id => (
          <RecentRow key={id} identifier={id} />
        ))}
      </ul>
    </div>
  );
};
