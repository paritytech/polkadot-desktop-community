// Runs every step, even past one that throws, then throws the one `Error`, or an AggregateError of all of them with
// `message`. Returns when no step threw.
export function runEvery(steps: readonly (() => void)[], message: string): void {
  const errors: unknown[] = [];
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw combineErrors(errors, message);
  }
}

// The one error when exactly one `Error` failed, and an AggregateError of all of them otherwise. Callers pass at least one
// error.
function combineErrors(errors: readonly unknown[], message: string): Error {
  const [only] = errors;
  if (errors.length === 1 && only instanceof Error) {
    return only;
  }
  return new AggregateError(errors, message);
}
