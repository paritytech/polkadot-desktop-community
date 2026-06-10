import { type NotificationActivatedEvent } from './types';

type Listener = (event: NotificationActivatedEvent) => void;

export type ClickRouter = {
  emit(event: NotificationActivatedEvent): void;
  subscribe(listener: Listener): VoidFunction;
  pendingCount(): number;
};

export function createClickRouter(): ClickRouter {
  const buffered: NotificationActivatedEvent[] = [];
  const listeners = new Set<Listener>();

  function emit(event: NotificationActivatedEvent): void {
    if (listeners.size === 0) {
      buffered.push(event);
      return;
    }
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('[notifications] click listener threw', error);
      }
    }
  }

  function subscribe(listener: Listener): VoidFunction {
    listeners.add(listener);

    if (buffered.length > 0) {
      const drained = buffered.splice(0, buffered.length);
      for (const event of drained) {
        try {
          listener(event);
        } catch (error) {
          console.warn('[notifications] click listener threw on drain', error);
        }
      }
    }

    return () => {
      listeners.delete(listener);
    };
  }

  function pendingCount(): number {
    return buffered.length;
  }

  return { emit, subscribe, pendingCount };
}
