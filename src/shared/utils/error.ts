export function toError(err: unknown) {
  if (err instanceof Error) {
    return err;
  }

  if (err) {
    return new Error(err.toString());
  }

  return new Error('Unknown error occurred.');
}
