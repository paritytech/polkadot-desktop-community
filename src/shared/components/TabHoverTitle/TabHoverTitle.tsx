type Props = {
  title: string;
};

// The bold title line shared by every tabHoverSlot renderer.
export const TabHoverTitle = ({ title }: Props) => (
  <span className="truncate text-sm font-semibold text-fg-primary">{title}</span>
);
