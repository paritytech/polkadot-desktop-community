export function minBigInt(...values: bigint[]) {
  if (values.length === 0) {
    return 0n;
  }
  return values.reduce((a, b) => (b < a ? b : a));
}

export function maxBigInt(...values: bigint[]) {
  if (values.length === 0) {
    return 0n;
  }
  return values.reduce((a, b) => (b > a ? b : a));
}
