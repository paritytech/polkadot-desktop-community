import { isFunction } from 'lodash-es';

/**
 * Get new array with item inserted at given position
 *
 * @param collection Array of items
 * @param item Value to be inserted
 * @param position At which position
 *
 * @returns {Array}
 */
export function splice<T>(collection: T[], item: T, position: number): T[] {
  return collection.slice(0, position).concat(item, collection.slice(position + 1));
}

type MergeParams<T> = {
  a: T[];
  b: T[];
  mergeBy: (value: T) => PropertyKey | (PropertyKey | undefined)[];
  merge?: (a: T, b: T) => T;
  sort?: (a: T, b: T) => number;
  filter?: (a: T, b: T) => boolean;
};

const createMergeKey = (key: PropertyKey | (PropertyKey | undefined)[]) => {
  return Array.isArray(key) ? key.join('|') : key;
};

export const mergeArrays = <T>({ a, b, mergeBy, merge, sort, filter }: MergeParams<T>) => {
  if (a.length === 0) {
    if (b.length === 0) {
      return a;
    }

    if (sort) {
      return [...b].sort(sort);
    }

    return b;
  }

  if (b.length === 0) {
    return a;
  }

  const map: Record<PropertyKey, T> = {};

  for (let i = 0; i < a.length; i++) {
    const item = a[i];
    if (!item) {
      continue;
    }

    map[createMergeKey(mergeBy(item))] = item;
  }

  let hadAnyChanges = false;

  for (let i = 0; i < b.length; i++) {
    const item = b[i];
    if (!item) {
      continue;
    }

    const key = createMergeKey(mergeBy(item));

    if (key in map) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const prev = map[key] as T;
      if (!filter || filter(prev, item)) {
        hadAnyChanges = true;
        map[key] = merge ? merge(prev, item) : item;
      }
    } else {
      hadAnyChanges = true;
      map[key] = item;
    }
  }

  if (hadAnyChanges) {
    const res = Object.values(map);

    return isFunction(sort) ? res.sort(sort) : res;
  } else {
    return isFunction(sort) ? a.sort(sort) : a;
  }
};

export const groupBy = <const T, const K extends PropertyKey>(
  iterable: Iterable<T>,
  map: (value: NoInfer<T>) => K,
): Record<K, T[]> => {
  const groups: Partial<Record<K, T[]>> = {};

  for (const item of iterable) {
    const itemKey = map(item);

    let list = groups[itemKey];
    if (list === undefined) {
      list = [];
      groups[itemKey] = list;
    }

    list.push(item);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return groups as Record<K, T[]>;
};

export const keys = <K extends PropertyKey>(values: Record<K, unknown>): K[] => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return Object.keys(values) as K[];
};

export const entries = <K extends string | number, T>(values: Record<K, T>): [key: K, value: T][] => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return Object.entries(values) as [key: K, value: T][];
};

export const fromEntries = <Key extends PropertyKey, Value>(values: [key: Key, value: Value][]): Record<Key, Value> => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return Object.fromEntries(values) as Record<Key, Value>;
};
