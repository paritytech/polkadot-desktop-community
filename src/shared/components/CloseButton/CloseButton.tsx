import { X } from 'lucide-react';
import { type MouseEvent } from 'react';

type CloseButtonProps = {
  onClick: () => void;
  size?: 'sm' | 'md';
};

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
};

export const CloseButton = ({ onClick, size = 'md' }: CloseButtonProps) => {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      className={`absolute -top-1 -right-1 z-10 flex items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-md backdrop-blur-sm transition-all hover:scale-110 hover:bg-red-500 hover:text-white ${sizeClasses[size]}`}
      onClick={handleClick}
    >
      <X className="h-3 w-3" />
    </button>
  );
};
