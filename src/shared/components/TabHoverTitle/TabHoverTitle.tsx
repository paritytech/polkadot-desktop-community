type Props = {
  title: string;
};

// The bold title line shared by every tabHoverSlot renderer.
export const TabHoverTitle = ({ title }: Props) => (
  <span className="truncate text-sm leading-5 font-semibold text-text-primary">{title}</span>
);
