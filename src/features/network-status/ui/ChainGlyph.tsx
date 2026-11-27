import { type KnownChainRole } from '@/domains/network';

type Props = {
  role: KnownChainRole | null;
  className?: string;
};

// Six dots on a hexagon.
const RelayGlyph = () => (
  <>
    <circle cx="5" cy="1.3" r="1.25" />
    <circle cx="8.204" cy="3.15" r="1.25" />
    <circle cx="8.204" cy="6.85" r="1.25" />
    <circle cx="5" cy="8.7" r="1.25" />
    <circle cx="1.796" cy="6.85" r="1.25" />
    <circle cx="1.796" cy="3.15" r="1.25" />
  </>
);

// A star cut out of a scalloped badge.
const HubGlyph = () => (
  <path
    fillRule="evenodd"
    d="M0.156 2.773C0.776 2.57 1.461 2.305 2.078 2.083C2.158 1.898 2.252 1.609 2.322 1.414L2.777 0.155L4.297 0.447C4.447 0.476 4.857 0.562 4.993 0.571C5.085 0.577 5.543 0.477 5.671 0.452C6.189 0.351 6.708 0.252 7.227 0.156L7.921 2.083L9.847 2.775C9.766 3.276 9.641 3.8 9.553 4.301C9.529 4.44 9.434 4.856 9.433 4.977C9.432 5.137 9.531 5.585 9.565 5.759L9.847 7.218C9.829 7.236 8.101 7.855 7.924 7.919C7.687 8.513 7.444 9.234 7.228 9.844C6.722 9.767 6.178 9.633 5.669 9.546C5.522 9.521 5.15 9.434 5.017 9.431C4.879 9.429 4.475 9.52 4.323 9.548C3.808 9.643 3.291 9.756 2.776 9.843L2.36 8.688C2.273 8.448 2.174 8.15 2.076 7.918C1.453 7.681 0.785 7.451 0.155 7.225C0.283 6.512 0.464 5.717 0.569 4.996C0.58 4.919 0.47 4.41 0.449 4.304C0.349 3.794 0.251 3.283 0.156 2.773ZM5.001 0.588C4.664 1.707 4.296 2.854 3.974 3.976C3.177 4.197 2.367 4.472 1.57 4.704C1.452 4.738 0.667 4.968 0.604 5.007C0.99 5.114 1.392 5.242 1.776 5.359L3.977 6.027C4.301 7.15 4.662 8.291 5.002 9.411L6.027 6.028L8.319 5.332L9.006 5.124C9.113 5.091 9.297 5.04 9.392 4.998C9.065 4.88 8.65 4.771 8.311 4.667L6.029 3.974L5.341 1.71C5.231 1.348 5.101 0.95 5.001 0.588Z"
  />
);

// A folder.
const StorageGlyph = () => <path d="M0.931 1.476H3.52L4.572 2.76H9.069V8.524H0.931V1.476Z" />;

// A head over shoulders.
const IdentityGlyph = () => (
  <path d="M9.085 9.625H0.915V5.569H9.085V9.625ZM5 0.375C6.268 0.375 7.296 1.403 7.296 2.672C7.296 3.94 6.268 4.969 5 4.969C3.731 4.969 2.703 3.94 2.703 2.672C2.703 1.403 3.731 0.375 5 0.375Z" />
);

// A diamond, for a chain outside the known roles.
const OtherChainGlyph = () => <path d="M5 0.8L9.2 5L5 9.2L0.8 5Z" />;

const GlyphShape = ({ role }: Pick<Props, 'role'>) => {
  switch (role) {
    case 'relay':
      return <RelayGlyph />;
    case 'assetHub':
      return <HubGlyph />;
    case 'bulletin':
      return <StorageGlyph />;
    case 'people':
      return <IdentityGlyph />;
    case null:
      return <OtherChainGlyph />;
  }
};

// The glyph that names a chain by its role, as the mobile app draws it.
export const ChainGlyph = ({ role, className }: Props) => (
  <svg className={className} width={12} height={12} viewBox="0 0 10 10" fill="currentColor" aria-hidden>
    <GlyphShape role={role} />
  </svg>
);
