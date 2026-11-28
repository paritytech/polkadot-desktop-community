import { FileDownIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { cnTw, formatBytes } from '@/shared/utils';
import { type RankedCandidate } from '@/domains/input-routing';
import { staggerDelay } from '../constants';
import { type CandidateGroup } from '../types';

import { CustomCandidate } from './CustomCandidate';
import { ProductIdentity } from './ProductIdentity';

type Props = {
  group: CandidateGroup;
  /** Position among the answering products, for the entrance stagger. */
  index: number;
  onSelect: (candidate: RankedCandidate) => void;
};

/**
 * Everything one product answered, under one heading.
 *
 * Ranking interleaves products, so before this a product with three answers was
 * three separate rows in three separate places, each restating whose they were.
 * One card per product says it once — and since the host is the only thing that
 * can honestly attribute a candidate, saying it once and clearly is the point of
 * the frame rather than decoration on it.
 *
 * Inside, the answers hang off a timeline: one rail down the left with a dot per
 * answer, each chunk keeping its own hover and its own press target. A rail says
 * "these are several things from one source" where a stack of dividers said
 * "these are several sources" — which was the opposite of what the card means.
 */
export const CandidateCard = ({ group, index, onSelect }: Props) => (
  <div
    style={{ animationDelay: staggerDelay(index) }}
    // Concentric with the card: the panel insets these by 8px, so a 16px radius
    // here keeps the curves parallel instead of running the inner corner tighter
    // than the outer one at the same nominal radius.
    className="animate-spotlight-row-in flex flex-col overflow-hidden rounded-2xl bg-bg-surface-nested/60"
  >
    <div className="px-4 pt-3 pb-1.5">
      <ProductIdentity productId={group.productId} />
    </div>

    {group.candidates.map((candidate, chunkIndex) => (
      <CandidateChunk
        key={candidate.id}
        candidate={candidate}
        first={chunkIndex === 0}
        last={chunkIndex === group.candidates.length - 1}
        onSelect={onSelect}
      />
    ))}
  </div>
);

type ChunkProps = {
  candidate: RankedCandidate;
  /** Ends of the rail: the line starts at the first dot and stops at the last. */
  first: boolean;
  last: boolean;
  onSelect: (candidate: RankedCandidate) => void;
};

/**
 * The timeline rail beside one answer, and its dot.
 *
 * Each chunk draws its own segment rather than the card drawing one line behind
 * all of them: a chunk is as tall as its content, and only the chunk knows that.
 * Consecutive segments meet edge to edge, so the result reads as one line.
 *
 * The rail is trimmed to the dots at both ends — starting above the first dot or
 * running past the last would point at nothing. A lone answer gets no rail at
 * all; a line between one thing and nothing is just a tick.
 */
const ChunkRail = ({ first, last }: { first: boolean; last: boolean }) => (
  <>
    {(!first || !last) && (
      <span
        aria-hidden
        className={cnTw('absolute start-4 w-px bg-stroke-primary', first ? 'top-5' : 'top-0', last ? 'h-5' : 'bottom-0')}
      />
    )}
    {/* 20px down: the chunk's 10px top padding plus half of the 20px first line,
        so the dot sits on the text's centre rather than above its cap height.
        The rail's two ends use the same 20px, or they would stop short of it. */}
    <span aria-hidden className="absolute start-3 top-4 size-2 rounded-full bg-stroke-secondary" />
  </>
);

/**
 * One answer.
 *
 * **Media is fetched to draw it.** RFC-0027 § Security says not to: the request
 * tells the product's server that this user saw this candidate, before the user
 * has chosen anything. Showing the thumbnails is worth more than that leak for
 * now — but it is a leak, and the fix when it matters is a host-side proxy or
 * fetching only once a candidate is taken, not a smaller thumbnail.
 *
 * A drawn candidate sits in a plain container rather than a button: it brings its
 * own controls, and a button inside a button is neither valid nor operable — the
 * outer one swallows the press.
 */
const CandidateChunk = ({ candidate, first, last, onSelect }: ChunkProps) => {
  const { content } = candidate;

  if (content.type === 'custom') {
    return (
      <div
        data-testid={TEST_IDS.inputModalityCandidate}
        data-product={candidate.productId}
        className="relative ps-8 pe-4 pt-1 pb-3"
      >
        <ChunkRail first={first} last={last} />
        <CustomCandidate productId={candidate.productId} content={content} />
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid={TEST_IDS.inputModalityCandidate}
      data-product={candidate.productId}
      className="relative flex w-full flex-col items-start gap-0.5 py-2.5 ps-8 pe-4 text-left transition-colors hover:bg-bg-selection-container-hover"
      onClick={() => onSelect(candidate)}
    >
      <ChunkRail first={first} last={last} />

      {content.type === 'text' && <span className="text-sm text-fg-primary">{content.text}</span>}

      {content.type === 'richText' && (
        <>
          {content.text && <span className="text-sm text-fg-primary">{content.text}</span>}
          {content.media.length > 0 && (
            <span className="flex flex-wrap gap-1.5 pt-1">
              {content.media.map((media, mediaIndex) => (
                // Position is the only identity a media entry has — the product
                // sends no id, and two entries may share a URL. The list never
                // reorders: it is one immutable answer.
                <img
                  // eslint-disable-next-line react/no-array-index-key
                  key={mediaIndex}
                  src={media.url}
                  alt={media.alt ?? ''}
                  loading="lazy"
                  className="size-16 shrink-0 rounded-xl bg-bg-surface-nested object-cover text-xs text-fg-secondary"
                />
              ))}
            </span>
          )}
        </>
      )}

      {content.type === 'file' && (
        <span className="flex items-center gap-1 text-sm text-fg-primary">
          <FileDownIcon className="size-3.5 shrink-0 text-fg-secondary" />
          {content.file.fileName}
          <span className="text-xs text-fg-secondary">{formatBytes(content.file.sizeBytes)}</span>
        </span>
      )}
    </button>
  );
};
