import { useEffect } from 'react';

let openLayers = 0;

// Counts open layers only: it renders inside a Radix Content, which unmounts on close, while the Root stays mounted.
// TODO(floating): remove when Radix's react-remove-scroll no longer leaves the body lock behind after a portal cycle
export const BodyLockSweep = () => {
  useEffect(() => {
    openLayers += 1;

    return () => {
      openLayers -= 1;
      if (openLayers > 0) return;

      queueMicrotask(() => {
        if (openLayers > 0) return;

        const { body } = document;
        if (body.style.pointerEvents === 'none') {
          body.style.pointerEvents = '';
        }
        body.removeAttribute('data-scroll-locked');
      });
    };
  }, []);

  return null;
};
