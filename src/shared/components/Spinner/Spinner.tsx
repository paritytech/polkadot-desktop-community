import { useEffect, useRef } from 'react';

const PETAL_PATHS = [
  'M31.0155 57.7181C14.6547 76.7768 14.2233 103.306 30.0862 116.92C45.9492 130.566 72.0667 126.15 88.4607 107.058C104.821 87.9995 105.253 61.4701 89.3899 47.8567C83.1841 42.511 75.3522 39.9543 67.1884 39.9543C54.5113 39.9543 40.9713 46.1302 31.0155 57.7181Z',
  'M26.2694 156.332C13.9574 170.941 19.3003 195.744 38.2164 211.715C57.1326 227.686 82.4868 228.815 94.7989 214.205C107.111 199.596 101.768 174.793 82.8518 158.822C72.8296 150.355 61.0153 146.072 50.2962 146.072C40.7718 146.072 32.077 149.459 26.3026 156.332',
  'M137.343 209.789C115.142 216.795 99.8429 231.072 103.161 241.664C106.513 252.256 127.221 255.178 149.423 248.139C171.625 241.133 186.923 226.856 183.605 216.264C181.481 209.59 172.454 205.938 160.507 205.938C153.505 205.938 145.54 207.166 137.343 209.756',
  'M102.597 18.5365C98.0176 31.7514 112.553 48.8179 135.12 56.6871C157.686 64.5562 179.689 60.2066 184.268 46.9917C188.848 33.7768 174.313 16.7103 151.746 8.84109C144.146 6.18482 136.58 4.9231 129.744 4.9231C116.303 4.9231 105.617 9.77078 102.597 18.5365Z',
  'M204.048 45.169C197.51 47.7921 199.07 66.884 207.499 87.7357C215.928 108.621 228.041 123.396 234.579 120.773C241.083 118.15 239.557 99.0912 231.128 78.2063C223.362 58.9484 212.444 44.8702 205.674 44.8702C205.11 44.8702 204.579 44.9698 204.048 45.169Z',
  'M209.058 172.038C199.766 192.192 196.547 210.553 201.89 213.01C207.233 215.468 219.114 201.124 228.406 180.969C237.731 160.815 240.917 142.453 235.607 139.996C235.209 139.797 234.778 139.731 234.28 139.731C228.472 139.731 217.654 153.411 209.058 172.038Z',
];

const PETAL_COUNT = PETAL_PATHS.length;
const CYCLE_DURATION = 1400;
const INITIAL_OPACITY = 0.15;
const INITIAL_SCALE = 0.92;
const EASING = 0.3;

export const Spinner = ({ size = 120 }: { size?: number }) => {
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    let rafId: number | null = null;
    let start: number | null = null;
    const opacities = new Array<number>(PETAL_COUNT).fill(INITIAL_OPACITY);
    const scales = new Array<number>(PETAL_COUNT).fill(INITIAL_SCALE);

    const animate = (ts: number) => {
      if (start === null) start = ts;

      const progress = ((ts - start) % CYCLE_DURATION) / CYCLE_DURATION;
      for (let i = 0; i < PETAL_COUNT; i++) {
        let dist = progress - i / PETAL_COUNT;
        if (dist < 0) dist += 1;
        const brightness = Math.max(0.15, Math.pow(Math.max(0, 1 - dist * 2.5), 2));
        const targetScale = 0.92 + 0.08 * brightness;

        const nextOpacity = (opacities[i] ?? INITIAL_OPACITY) + (brightness - (opacities[i] ?? INITIAL_OPACITY)) * EASING;
        const nextScale = (scales[i] ?? INITIAL_SCALE) + (targetScale - (scales[i] ?? INITIAL_SCALE)) * EASING;
        opacities[i] = nextOpacity;
        scales[i] = nextScale;

        const el = pathRefs.current[i];
        if (el) {
          el.style.opacity = String(nextOpacity);
          el.style.transform = `scale(${nextScale})`;
        }
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      {PETAL_PATHS.map((d, i) => (
        <path
          key={d}
          ref={el => {
            pathRefs.current[i] = el;
          }}
          d={d}
          fill="currentColor"
          style={{
            opacity: INITIAL_OPACITY,
            transform: `scale(${INITIAL_SCALE})`,
            transformOrigin: '128px 128px',
          }}
        />
      ))}
    </svg>
  );
};
