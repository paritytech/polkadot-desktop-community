import { type Serializable } from '@/shared/types';

export const hasProperty = <T extends object, K extends string>(value: T, field: K): value is Extract<T, Record<K, unknown>> => {
  try {
    // @ts-expect-error we use this call instead of `field in value` because of papi's Proxy implementation.
    return value[field] !== undefined;
  } catch {
    return false;
  }
};

export const toSerializable = <T>(value: T): Serializable<T> => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined' ||
    value === null
  ) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return value as never;
  }

  if (value instanceof Date) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return value.toISOString() as never;
  }

  if (value instanceof Set) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Array.from(value) as never;
  }

  if (value instanceof Map) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Object.fromEntries(value) as never;
  }

  if (Array.isArray(value)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return value.map(toSerializable) as Serializable<T>;
  }

  const res: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(value)) {
    res[k] = toSerializable(v);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res as never;
};
