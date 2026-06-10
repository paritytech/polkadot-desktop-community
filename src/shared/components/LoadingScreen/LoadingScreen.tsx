import { Spinner } from '../Spinner/Spinner';

export const LoadingScreen = () => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-general-muted text-foreground duration-500 animate-in fade-in">
      <Spinner size={120} />
    </div>
  );
};
