import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { routingUseCase } from '@/domains/input-routing';
import { useDotNsTld } from '@/domains/product';

type Props = {
  onDecoded: (text: string) => void;
  onCancel: VoidFunction;
};

/**
 * Camera capture with a confirmation gate.
 *
 * RFC-0027 § When routing happens makes the gate normative: a camera decoding
 * continuously never routes on its own. Decoding stops the stream and shows what
 * was read *and what will happen*; nothing is routed until the user confirms, and
 * dismissing routes nothing at all.
 */
export const QrScanner = ({ onDecoded, onCancel }: Props) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [decoded, setDecoded] = useState<string | null>(null);
  // The frame the code was read from, kept as an image so the camera can stop the
  // instant it has what it needs. A stopped track paints nothing, so holding the
  // <video> would leave a black square where the evidence should be.
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (decoded !== null) return;

    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && context && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height);
        if (code) {
          setFrozenFrame(canvas.toDataURL('image/jpeg', 0.7));
          setDecoded(code.data);

          return;
        }
      }
      frame = requestAnimationFrame(scan);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(granted => {
        if (stopped) {
          for (const track of granted.getTracks()) track.stop();

          return;
        }
        stream = granted;
        if (videoRef.current) videoRef.current.srcObject = granted;
        frame = requestAnimationFrame(scan);
      })
      .catch((cause: unknown) => {
        const denied = cause instanceof DOMException && cause.name === 'NotAllowedError';
        setError(denied ? t('feature.inputModality.scanDenied') : t('feature.inputModality.scanUnavailable'));
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
  }, [decoded, t]);

  return (
    // No top border: with the field hidden while scanning this is the card's only
    // content, so the line would be drawn against nothing.
    // Sized by its content, with no cap of its own: a cap here would be the
    // padding's to spend, and the viewfinder would come out narrower than the
    // square it is supposed to be. The one thing that can grow unboundedly is the
    // decoded string, so the cap lives on the preview that shows it.
    //
    // `mx-auto` is load-bearing during the morph: a `w-fit` box in a block
    // container sits at the start edge, so while the card animates down from the
    // search width the viewfinder would cling to the left and slide, rather than
    // staying under the cursor the whole way.
    <div
      data-testid={TEST_IDS.inputModalityScanner}
      className="animate-spotlight-scanner-in mx-auto flex w-fit flex-col gap-2 p-3"
    >
      {error && <span className="px-1 text-sm text-fg-error">{error}</span>}

      {/* A fixed square, cropped rather than letterboxed: a camera hands back
          whatever aspect ratio it likes, and a viewfinder that changes shape with
          the device is a worse target to aim a code at than a stable one.

          The frame stays after a decode, blurred and dimmed under the result. It
          is the evidence that this reading came from what the camera was pointed
          at a moment ago — replacing it with a bare panel severs the decoded
          string from where it came from, which is the one thing the user is being
          asked to judge. */}
      {!error && (
        // `overflow-hidden` on the frame, not on the blurred child: a blur softens
        // an element's own edges, so an unclipped one would fray past the rounded
        // corner and haze the card behind it.
        <div className="relative size-100 overflow-hidden rounded-2xl bg-black">
          {frozenFrame ? (
            <img src={frozenFrame} alt="" className="size-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
          )}

          {/* The blur is the overlay's, not the frame's. A `filter` softens the
              element's own edges and would fray the frame's border; a
              `backdrop-filter` blurs what is behind it and stops dead at its own
              bounds, so the border stays as crisp as the corner clipping it. The
              tint lightens rather than darkens — the point is to push the photo
              back, and dimming it to near-black loses the evidence it is there
              to be. */}
          {decoded !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 p-5 backdrop-blur-md">
              <ScannedPreview decoded={decoded} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('feature.inputModality.scanCancel')}
        </Button>
        {decoded !== null && (
          <Button variant="primary" data-testid={TEST_IDS.inputModalityScanConfirm} onClick={() => onDecoded(decoded)}>
            {t('feature.inputModality.scanConfirm')}
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * What was decoded, and what accepting it will do.
 *
 * Showing the string alone is not the RFC's gate: a scanned navigation is the one
 * input that can move a user somewhere they did not choose, so the consequence
 * has to be legible before the button is pressed.
 */
const ScannedPreview = ({ decoded }: { decoded: string }) => {
  const { t } = useTranslation();
  const { data: tld } = useDotNsTld();
  const routed = routingUseCase.resolveInput(decoded, tld);

  return (
    // Opaque, not translucent: the string underneath has to be read exactly, and
    // a blurred camera frame showing through the character it is being compared
    // against is the wrong place to be clever.
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-bg-surface-container p-5 shadow-2xl">
      <span className="text-xs text-fg-secondary">{t('feature.inputModality.scanPrompt')}</span>
      <span className="font-mono text-sm break-all text-fg-primary">{decoded}</span>
      <span className="text-sm text-fg-secondary">
        {routed.type === 'query'
          ? t('feature.inputModality.scanWillAsk')
          : t('feature.inputModality.scanWillOpen', { productId: routed.productId })}
      </span>
    </div>
  );
};
