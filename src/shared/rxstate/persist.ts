import { createLocalStorageAdapter } from '@novasamatech/storage-adapter';
import { err, fromThrowable } from 'neverthrow';

import { nonNullable } from '@/shared/utils';

import { type RxState } from './state';

type LocalStorageParams<T> = {
  key: string;
  decode?(v: string): T;
  encode?(v: T): string;
  sync?: boolean;
};

export function persistLocalStorage<T>(
  state: RxState<T>,
  { key, sync = true, encode = JSON.stringify, decode = JSON.parse }: LocalStorageParams<T>,
) {
  const localStorage = createLocalStorageAdapter(key);
  const wrappedEncode = fromThrowable(encode);
  const wrappedDecode = fromThrowable(decode);

  state.value$.subscribe(v => {
    if (v === state.getInitial()) {
      return;
    }
    wrappedEncode(v)
      .asyncAndThen(v => localStorage.write('value', v))
      .match(
        () => {},
        e => console.error('Error while writing to local storage', e),
      );
  });

  if (sync) {
    localStorage
      .read('value')
      .andThen(v => (nonNullable(v) ? wrappedDecode(v) : err(null)))
      .match(state.set, e => {
        if (e === null) {
          return;
        }
        console.error('Error while reading from local storage', e);
      });
  }
}
