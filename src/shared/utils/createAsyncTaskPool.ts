import { createNanoEvents } from 'nanoevents';

import { nullable, promiseWithResolvers } from './functions';

export const DEFAULT_POOL = 'default';

type Params = {
  poolSize: number;
  retryCount?: number;
  retryDelay?: ((attempt: number) => number) | number;
};

type Task<T = unknown> = {
  fn: () => T | PromiseLike<T>;
  pool: string;
  retry: number;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  retryTimeout?: ReturnType<typeof setTimeout>;
};

type TaskParams = { pool?: string; signal?: AbortSignal };

/**
 * Task manager with queues, retries and named pools.
 */
class AsyncTaskPool {
  private events = createNanoEvents<{
    settled: (pool: string) => void;
  }>();
  private queue: Task[] = [];
  private activeTasks: Task[] = [];

  constructor(private readonly config: Params) {}

  call<T>(fn: () => T | Promise<T>, params?: TaskParams) {
    const { resolve, reject, promise } = promiseWithResolvers<T>();
    const signal = params?.signal;

    if (signal?.aborted) {
      reject(signal.reason);
      return promise;
    }

    const task: Task<T> = {
      fn,
      pool: params?.pool ?? DEFAULT_POOL,
      retry: 0,
      resolve,
      reject,
      signal,
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    signal?.addEventListener('abort', () => this.abortTask(task as Task), { once: true });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.queue.push(task as Task);
    this.processPool(task.pool);

    return promise;
  }

  private abortTask(task: Task) {
    if (task.retryTimeout !== undefined) clearTimeout(task.retryTimeout);

    const queueIndex = this.queue.indexOf(task);
    if (queueIndex >= 0) this.queue.splice(queueIndex, 1);
    this.activeTasks = this.activeTasks.filter(x => x !== task);

    task.reject(task.signal?.reason);
    this.processPool(task.pool);
    this.tryToSettlePool(task.pool);
  }

  settle(pool: string) {
    if (this.queue.length === 0 && this.activeTasks.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      const handler = (done: string) => {
        if (done === pool) {
          unsubscribe();
          resolve();
        }
      };

      const unsubscribe = this.events.on('settled', handler);
    });
  }

  private async processPool(pool: string) {
    let task: Task | null = null;

    const activeTasks = this.activeTasks.filter(x => x.pool === pool);
    // skip this iteration since task pool at full capacity
    if (activeTasks.length >= this.config.poolSize) {
      return;
    }

    // finding the next task
    for (const [index, potentialTask] of this.queue.entries()) {
      if (potentialTask.pool !== pool) {
        continue;
      }

      task = potentialTask;
      this.queue.splice(index, 1);
      break;
    }

    if (nullable(task)) {
      this.tryToSettlePool(pool);
      return;
    }

    this.activeTasks.push(task);

    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      if (task.signal?.aborted) return;

      const retryCount = this.config.retryCount ?? 0;

      if (task.retry >= retryCount) {
        task.reject(error);
      } else {
        const retryDelay = this.retryDelay(task);
        task.retry++;
        task.retryTimeout = setTimeout(() => {
          this.queue.push(task);
          this.processPool(pool);
        }, retryDelay);
      }
    } finally {
      this.activeTasks = this.activeTasks.filter(x => x !== task);
      this.processPool(pool);
    }
  }

  private tryToSettlePool(pool: string) {
    const activePoolTasks = this.activeTasks.find(x => x.pool === pool);
    const queuedPoolTasks = this.queue.find(x => x.pool === pool);

    if (nullable(activePoolTasks) && nullable(queuedPoolTasks)) {
      this.events.emit('settled', pool);
    }
  }

  private retryDelay(task: Task) {
    return typeof this.config.retryDelay === 'function' ? this.config.retryDelay(task.retry) : (this.config.retryDelay ?? 0);
  }
}

export const createAsyncTaskPool = (params: Params) => new AsyncTaskPool(params);
