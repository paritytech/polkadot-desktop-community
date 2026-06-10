import { type ReactNode, useState } from 'react';

import { type Icon, useProductIcon } from '@/domains/product';

type ProductIconProps = {
  icon: Nullable<Icon>;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
};

export const ProductIcon = ({ icon, alt, className, fallback }: ProductIconProps) => {
  const { data: dataUrl } = useProductIcon(icon);
  const [errored, setErrored] = useState(false);
  if (errored) return fallback ?? null;
  if (dataUrl) return <img src={dataUrl} alt={alt ?? ''} className={className} onError={() => setErrored(true)} />;
  return fallback ?? null;
};
