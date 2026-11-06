/**
 * The fields of a `CoreStorageKey` the host keeps alongside the encoded key.
 *
 * The core addresses every slot by the encoded key; these are its own decoded
 * fields, kept so the host can answer "which permission slots am I holding for
 * this product", which the core's point-lookup API cannot.
 */
export type CoreSlotDescriptor = {
  slotTag: string;
  productId?: string;
  /** Bare product label owning a slot shared by every executable of that product. */
  productLabel?: string;
  /**
   * The slot's request, SCALE-encoded with the core's own codec.
   *
   * Bytes rather than a decoded object on purpose: the package generates the codec, so
   * storing its output means the shape is never restated here. A hand-written mirror of
   * a generated union drifts silently — a variant added upstream would fail to parse and
   * the slot would go invisible with no error.
   */
  request?: Uint8Array;
};
