import { type Effect, type EventCallable, type Scope, createEffect, is, scopeBind } from 'effector';

type Config = {
  /**
   * Runs all effects in parallel if true
   */
  parallel?: boolean;
  /**
   * Continue loop even if some effects are failed
   */
  skipErrors?: boolean;
  /**
   * Optional scope binding
   */
  scope?: Scope;
};

/**
 * Triggers target unit on each element of the input list.
 *
 * ```ts
 * const $store = createStore<number[]>([]);
 * const event = createEvent<number>();
 *
 * sample({
 *   clock: $store,
 *   target: series(event),
 * });
 *
 * $store.set([0, 1, 3]);
 * // event will be called 3 times, direct equivalent of
 * // event(0); event(1); event(2)
 * ```
 */
export const series = <T, R = void>(target: EventCallable<T> | Effect<T, R>, config?: Config) => {
  const isParallel = config?.parallel ?? false;
  const skipErrors = config?.skipErrors ?? false;

  const fx: Effect<Iterable<T> | AsyncIterable<T>, R[]> = createEffect(async (data: Iterable<T> | AsyncIterable<T>) => {
    const t = scopeBind(target, { scope: config?.scope, safe: true });
    const queuedAcc: R[] = [];
    const parallelAcc: Promise<R>[] = [];

    const runOn = async (value: T) => {
      try {
        if (is.effect(target)) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const result = (t as typeof target)(value);
          if (isParallel) {
            parallelAcc.push(result);
          } else {
            queuedAcc.push(await result);
          }
        } else {
          t(value);
        }
      } catch (e) {
        if (skipErrors) return;
        throw e;
      }
    };

    if (Symbol.asyncIterator in data) {
      for await (const value of data) {
        await runOn(value);
      }
    } else {
      for (const value of data) {
        await runOn(value);
      }
    }

    if (!isParallel) {
      return queuedAcc;
    }

    return Promise.allSettled(parallelAcc).then(results => {
      const successResults = results.filter(s => s.status === 'fulfilled').map(s => s.value);

      if (skipErrors) {
        return successResults;
      }
      for (const result of results) {
        if (result.status === 'rejected') {
          throw result.reason;
        }
      }

      return successResults;
    });
  });

  return fx;
};
