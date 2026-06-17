import { type Result, ResultAsync, err } from 'neverthrow';

// Upper bound on how long we wait for a remote signature. The remote-signing
// path goes through the Statement Store on Bulletin Paseo; if that chain's
// follow is dead, both the request submission and the response wait will hang
// forever. host-papp wraps each call in an internal poolSize:1 queue, so a
// single hung request also wedges every subsequent signing request. Bound it
// so the user sees an error instead of an indefinite spinner.
export const SIGNING_TIMEOUT_MS = 240_000;

export const SIGNING_TIMEOUT_MESSAGE = 'Signing request timed out — the remote signer did not respond.';

/**
 * Race a `ResultAsync<T, Error>` against a timeout. If the timeout fires first,
 * the resulting `ResultAsync` rejects so the modal's existing failure path
 * runs (close modal, surface SigningErr.Unknown to the product).
 *
 * The underlying promise from host-papp keeps running — we cannot cancel it —
 * but the user-visible UI is no longer blocked.
 */
export function withSigningTimeout<T>(resultAsync: ResultAsync<T, Error>, timeoutMs = SIGNING_TIMEOUT_MS): ResultAsync<T, Error> {
  let handle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<Result<T, Error>>(resolve => {
    handle = setTimeout(() => resolve(err(new Error(SIGNING_TIMEOUT_MESSAGE))), timeoutMs);
  });

  const original: Promise<Result<T, Error>> = Promise.resolve(resultAsync);

  const raced = Promise.race([original, timeoutPromise]).finally(() => {
    if (handle !== null) clearTimeout(handle);
  });

  return new ResultAsync(raced);
}
