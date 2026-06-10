import * as v from 'valibot';

export type HexString = `0x${string}`;

export const hexString = v.pipe(
  v.string(),
  v.regex(/^0x[\s\S]*$/u, 'must start with 0x'),
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- valibot has no templateLiteral; this single cast lets the schema's output type stay `0x${string}` for downstream type inference
  v.transform(s => s as HexString),
);

export type Serializable<T> = T extends string | number | null | undefined | boolean
  ? T
  : T extends Date
    ? string
    : T extends (infer I)[]
      ? Serializable<I>[]
      : T extends Set<infer I>
        ? Serializable<I>[]
        : T extends Map<string, infer I>
          ? Record<string, I>
          : T extends NonNullable<unknown>
            ? {
                [K in keyof T]: Serializable<T[K]>;
              }
            : never;

export type Without<T, U extends PropertyKey> = { [P in Exclude<keyof T, U>]?: never };

export type XOR<T, U = object> = T | U extends object ? (Without<T, keyof U> & U) | (Without<U, keyof T> & T) : T | U;

export type ArrayElement<T extends unknown[]> = T extends (infer E)[] ? E : never;

export type NullableMap<T extends Record<PropertyKey, unknown>> = {
  [K in keyof T]: T[K] | undefined | null;
};
