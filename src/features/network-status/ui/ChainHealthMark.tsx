import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type KnownChainRole } from '@/domains/network';
import { RING_RADIUS } from '../constants';
import { networkStatusService } from '../service';
import { type ChainMark } from '../types';

import { ChainGlyph } from './ChainGlyph';

type Props = {
  mark: ChainMark;
  role: KnownChainRole | null;
};

// A ring of radius 12.2 with ten waves of 0.9, as the mobile app draws a chain still connecting.
const SCALLOP =
  'M27.10 14.00L26.96 14.68L26.58 15.32L26.05 15.91L25.49 16.44L25.03 16.96L24.75 17.49L24.66 18.09L24.73 18.78L24.87 19.54L24.96 20.32L24.89 21.07L24.60 21.70L24.09 22.17L23.40 22.46L22.63 22.63L21.86 22.73L21.19 22.88L20.64 23.14L20.22 23.58L19.88 24.18L19.54 24.87L19.15 25.56L18.65 26.12L18.05 26.46L17.36 26.54L16.63 26.37L15.91 26.05L15.23 25.69L14.60 25.40L14.00 25.30L13.40 25.40L12.77 25.69L12.09 26.05L11.37 26.37L10.64 26.54L9.95 26.46L9.35 26.12L8.85 25.56L8.46 24.87L8.13 24.18L7.78 23.58L7.36 23.14L6.81 22.88L6.14 22.73L5.37 22.63L4.60 22.46L3.91 22.17L3.40 21.70L3.11 21.07L3.04 20.32L3.13 19.54L3.27 18.78L3.34 18.09L3.25 17.49L2.97 16.96L2.51 16.44L1.95 15.91L1.42 15.32L1.04 14.68L0.90 14.00L1.04 13.32L1.42 12.68L1.95 12.09L2.51 11.56L2.97 11.04L3.25 10.51L3.34 9.91L3.27 9.22L3.13 8.46L3.04 7.67L3.11 6.93L3.40 6.30L3.91 5.83L4.60 5.54L5.37 5.37L6.14 5.27L6.81 5.12L7.36 4.86L7.78 4.42L8.12 3.82L8.46 3.13L8.85 2.44L9.35 1.88L9.95 1.54L10.64 1.46L11.37 1.63L12.09 1.95L12.77 2.31L13.40 2.60L14.00 2.70L14.60 2.60L15.23 2.31L15.91 1.95L16.63 1.63L17.36 1.46L18.05 1.54L18.65 1.88L19.15 2.44L19.54 3.13L19.88 3.82L20.22 4.42L20.64 4.86L21.19 5.12L21.86 5.27L22.63 5.37L23.40 5.54L24.09 5.83L24.60 6.30L24.89 6.93L24.96 7.67L24.87 8.46L24.73 9.22L24.66 9.91L24.75 10.51L25.03 11.04L25.49 11.56L26.05 12.09L26.58 12.68L26.96 13.32Z';

function pickArcStroke(mark: ChainMark): string {
  switch (mark.kind) {
    case 'short':
      if (mark.band === 'warn') {
        return 'stroke-chrome-warn';
      }
      return mark.band === 'err' ? 'stroke-chrome-err' : 'stroke-chrome-text';
    case 'outage':
    case 'connecting':
    case 'unavailable':
      return 'stroke-chrome-ring-strong';
    case 'healthy':
    case 'unused':
      return 'stroke-chrome-text';
  }
}

// Every layer stays drawn and the kind picks which show, so a change of kind morphs in CSS instead of redrawing.
// Hidden from assistive technology, so the caller says the state in words.
export const ChainHealthMark = ({ mark, role }: Props) => {
  const { kind } = mark;
  const arc = networkStatusService.traceArc(mark);

  return (
    <svg
      className="size-7 flex-none text-chrome-text"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
      data-kind={kind}
      data-testid={TEST_IDS.networkChainMark}
    >
      <circle
        className={cnTw(
          'stroke-chrome-ring motion-safe:transition-[opacity,rotate,scale,stroke,stroke-width,stroke-dasharray,stroke-dashoffset] motion-safe:duration-460 motion-safe:ease-chrome',
          kind === 'unused' ? 'stroke-1' : 'stroke-2',
          kind === 'short' || kind === 'unused' ? 'opacity-100' : 'opacity-0',
        )}
        cx="14"
        cy="14"
        r={RING_RADIUS}
      />
      {/* Mirrored, so the arc fills counterclockwise from the top. */}
      <circle
        className={cnTw(
          'motion-safe:transition-[opacity,rotate,scale,stroke,stroke-width,stroke-dasharray,stroke-dashoffset] motion-safe:duration-460 motion-safe:ease-chrome',
          pickArcStroke(mark),
          kind === 'healthy' || kind === 'short' || kind === 'outage' || kind === 'unavailable' ? 'opacity-100' : 'opacity-0',
        )}
        style={{ strokeDasharray: `${arc.dash} ${arc.gap}`, strokeDashoffset: arc.offset }}
        cx="14"
        cy="14"
        r={RING_RADIUS}
        strokeWidth={2}
        strokeLinecap="round"
        transform="translate(28 0) scale(-1 1) rotate(-90 14 14)"
      />
      <path
        className={cnTw(
          'origin-center stroke-chrome-ring-strong transform-view motion-safe:transition-[opacity,rotate,scale,stroke,stroke-width,stroke-dasharray,stroke-dashoffset] motion-safe:duration-460 motion-safe:ease-chrome',
          kind === 'connecting' ? 'scale-100 rotate-0 opacity-100' : 'scale-86 -rotate-36 opacity-0',
        )}
        d={SCALLOP}
        strokeWidth={1.5}
      />
      <circle
        className={cnTw(
          'origin-center fill-chrome-text transform-view motion-safe:transition-[opacity,rotate,scale,stroke,stroke-width,stroke-dasharray,stroke-dashoffset] motion-safe:duration-460 motion-safe:ease-chrome',
          kind === 'healthy' ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
        cx="14"
        cy="14"
        r="14"
      />
      <path
        className={cnTw(
          'origin-center stroke-chrome-faint transform-fill motion-safe:transition-[opacity,rotate,scale,stroke,stroke-width,stroke-dasharray,stroke-dashoffset] motion-safe:duration-460 motion-safe:ease-chrome',
          kind === 'outage' ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
        )}
        d="M3.7 3.7L6.7 6.7M6.7 3.7L3.7 6.7"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <g className={cnTw(kind === 'connecting' && 'motion-safe:animate-chain-pulse')} transform="translate(8 8)">
        <ChainGlyph
          role={role}
          className={cnTw(
            'motion-safe:transition-colors motion-safe:duration-460 motion-safe:ease-chrome',
            kind === 'healthy' && 'text-chrome-on-primary',
            (kind === 'outage' || kind === 'unavailable') && 'text-chrome-faint',
            kind === 'unused' && 'text-chrome-action-dim',
          )}
        />
      </g>
    </svg>
  );
};
