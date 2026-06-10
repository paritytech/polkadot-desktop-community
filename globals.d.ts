declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.webm' {
  const content: string;
  export default content;
}

declare module '*.mp4' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.svg?jsx' {
  import { type FC, type SVGProps } from 'react';
  const content: FC<SVGProps<SVGSVGElement>>;
  export default content;
}

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*?url' {
  const url: string;
  export default url;
}

declare module 'units-css' {
  const content: any;
  export default content;
}

declare module '@ensdomains/content-hash' {
  export function decode(encoded: string): string;
  export function getCodec(encoded: string): string;
}

type Nullable<T> = T | null | undefined;
