import { decode, isBlurhashValid } from 'blurhash';
import { type FC, useEffect, useRef } from 'react';

type Props = {
  hash: string;
  // Decode resolution in pixels. Kept small — a blurhash is low-frequency, so a
  // tiny bitmap upscaled by CSS is indistinguishable from a large decode while
  // staying cheap. Square; CSS stretches it to whatever box it fills.
  resolution?: number;
  punch?: number;
  className?: string;
};

// Generic, domain-agnostic renderer: paints a Wolt-spec blurhash string onto a
// canvas. Invalid/undecodable hashes leave the canvas transparent so a caller's
// fallback background shows through. Purely decorative — aria-hidden.
export const BlurhashCanvas: FC<Props> = ({ hash, resolution = 32, punch = 1, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isBlurhashValid(hash).result) return;

    const pixels = decode(hash, resolution, resolution, punch);
    const imageData = ctx.createImageData(resolution, resolution);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [hash, resolution, punch]);

  return <canvas ref={canvasRef} width={resolution} height={resolution} className={className} aria-hidden />;
};
