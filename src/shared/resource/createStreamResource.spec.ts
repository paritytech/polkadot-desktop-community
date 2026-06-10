import { produce } from 'immer';
import { BehaviorSubject, Subject, firstValueFrom, take } from 'rxjs';

import { createStreamResource } from './createStreamResource';

describe('createStreamResource', () => {
  describe('read$', () => {
    it('should subscribe and emit values', async () => {
      const subject = new Subject<string>();

      const resource = createStreamResource<{ id: string }>({ key: ({ id }) => id })
        .subscribe(() => subject.asObservable())
        .build();

      const promise = firstValueFrom(resource.read$({ id: '1' }));
      subject.next('hello');

      expect(await promise).toBe('hello');
    });

    it('should deduplicate concurrent reads with same key', () => {
      const subscribeFn = vi.fn().mockReturnValue(new Subject().asObservable());

      const resource = createStreamResource<{ id: string }>({ key: ({ id }) => id })
        .subscribe<string>(subscribeFn)
        .build();

      resource.read$({ id: '1' }).subscribe();
      resource.read$({ id: '1' }).subscribe();

      expect(subscribeFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('should force resubscribe after invalidation', () => {
      const subscribeFn = vi.fn().mockReturnValue(new BehaviorSubject('value').asObservable());

      const resource = createStreamResource<{ id: string }>({ key: ({ id }) => id })
        .subscribe<string>(subscribeFn)
        .build();

      const sub1 = resource.read$({ id: '1' }).subscribe();
      sub1.unsubscribe();

      resource.invalidate({ id: '1' });

      resource.read$({ id: '1' }).subscribe();

      expect(subscribeFn).toHaveBeenCalledTimes(2);
    });

    it('should not affect other keys', () => {
      const subscribeFn = vi.fn().mockReturnValue(new BehaviorSubject('value').asObservable());

      const resource = createStreamResource<{ id: string }>({ key: ({ id }) => id })
        .subscribe<string>(subscribeFn)
        .build();

      resource.read$({ id: 'a' }).subscribe();
      resource.read$({ id: 'b' }).subscribe();

      expect(subscribeFn).toHaveBeenCalledTimes(2);

      resource.invalidate({ id: 'a' });

      resource.read$({ id: 'a' }).subscribe();
      expect(subscribeFn).toHaveBeenCalledTimes(3);

      resource.read$({ id: 'b' }).subscribe();
      expect(subscribeFn).toHaveBeenCalledTimes(3);
    });

    it('should update cache$ with new data after resubscribe', async () => {
      let callCount = 0;
      const subscribeFn = vi.fn().mockImplementation(() => {
        callCount++;
        return new BehaviorSubject(`v${callCount}`).asObservable();
      });

      const resource = createStreamResource<{ id: string }>({ key: ({ id }) => id })
        .subscribe<string>(subscribeFn)
        .cache<Record<string, string>>({
          initial: {},
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      const sub = resource.read$({ id: '1' }).pipe(take(1)).subscribe();
      await firstValueFrom(resource.cache$);

      expect(await firstValueFrom(resource.cache$)).toEqual({ '1': 'v1' });

      sub.unsubscribe();
      resource.invalidate({ id: '1' });

      resource.read$({ id: '1' }).pipe(take(1)).subscribe();

      expect(await firstValueFrom(resource.cache$)).toEqual({ '1': 'v2' });
    });

    it('should clear cache$ entry on invalidate', async () => {
      let callCount = 0;
      const subscribeFn = vi.fn().mockImplementation(() => {
        callCount++;
        return new BehaviorSubject(`v${callCount}`).asObservable();
      });

      const resource = createStreamResource<{ id: string }>({ key: ({ id }) => id })
        .subscribe<string>(subscribeFn)
        .cache<Record<string, string>>({
          initial: {},
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      resource.read$({ id: 'a' }).pipe(take(1)).subscribe();
      resource.read$({ id: 'b' }).pipe(take(1)).subscribe();

      expect(await firstValueFrom(resource.cache$)).toEqual({ a: 'v1', b: 'v2' });

      resource.invalidate({ id: 'a' });

      expect(await firstValueFrom(resource.cache$)).toEqual({ b: 'v2' });
    });
  });

  describe('invalidateAll', () => {
    it('should reset cache$ and force resubscribe for all keys', async () => {
      const subscribeFn = vi.fn().mockReturnValue(new BehaviorSubject('value').asObservable());

      const resource = createStreamResource<{ id: string }>({ key: ({ id }) => id })
        .subscribe<string>(subscribeFn)
        .cache<Record<string, string>>({
          initial: {},
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      resource.read$({ id: 'a' }).pipe(take(1)).subscribe();
      resource.read$({ id: 'b' }).pipe(take(1)).subscribe();

      resource.invalidateAll();

      const cache = await firstValueFrom(resource.cache$);
      expect(cache).toEqual({});
    });
  });
});
