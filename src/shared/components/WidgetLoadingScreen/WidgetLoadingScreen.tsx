import { Spinner } from '../Spinner/Spinner';

// Loading state for a product rendered as a dashboard widget. Unlike
// `ProductLoadingScreen` (full-screen, large spinner + phrase), the widget body
// is a small surface, so it shows only a compact, subtle centered spinner.
export const WidgetLoadingScreen = () => {
  return (
    <div className="flex h-full w-full items-center justify-center text-foreground duration-500 animate-in fade-in">
      <div className="opacity-20">
        <Spinner size={24} />
      </div>
    </div>
  );
};
