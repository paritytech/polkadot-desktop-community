type DisposableLike = { readonly disposed: boolean };

export function guarded<Args extends unknown[], R>(
  instance: DisposableLike,
  fn: (...args: Args) => R,
): (...args: Args) => R | undefined {
  return (...args) => {
    if (instance.disposed) return undefined;
    return fn(...args);
  };
}
