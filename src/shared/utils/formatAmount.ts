const enum Suffix {
  THOUSANDS = 'K',
  MILLIONS = 'M',
  BILLIONS = 'B',
  TRILLIONS = 'T',
}

export const enum Decimal {
  SMALL_NUMBER = 5,
  BIG_NUMBER = 2,
}

const intl = new Intl.NumberFormat('en-US');

// TODO implement formatting according to spec.
export function amountToString(amount: bigint, precision: number): string {
  if (amount === 0n) return `0`;

  const str = amount.toString();
  const exponent = str.slice(0, Math.max(0, str.length - precision)) || '0';
  const mantissa = str.slice(-precision).padStart(precision, '0');

  const formattedExponent = intl.format(parseInt(exponent));

  if (parseInt(mantissa) === 0 || precision === 0) {
    return formattedExponent;
  }

  const mantissaLength = Math.max(mantissa.search(/[1-9]/) + 1, 3);

  return `${formattedExponent}.${mantissa.slice(0, mantissaLength)}`;
}

type FormatBalanceShorthands = Record<Suffix, boolean>;
type FormatBalanceConfig = Partial<{
  round: 'up' | 'down';
  shorthands: Partial<FormatBalanceShorthands>;
}>;

type FormattedBalance = {
  value: string;
  suffix: string;
  formatted: string;
};
const defaultBalanceShorthands: FormatBalanceShorthands = {
  [Suffix.TRILLIONS]: true,
  [Suffix.BILLIONS]: true,
  [Suffix.MILLIONS]: true,
  [Suffix.THOUSANDS]: false,
};
// TODO implement
export function amountToShortenString(amount: bigint, precision: number, config?: FormatBalanceConfig): FormattedBalance {
  const shorthands = config?.shorthands ?? defaultBalanceShorthands;
  const mergedShorthands =
    shorthands === defaultBalanceShorthands ? defaultBalanceShorthands : { ...defaultBalanceShorthands, ...shorthands };

  let divider = 0;
  let suffix = '';

  if (amount < 1_000_000n) {
    if (mergedShorthands[Suffix.THOUSANDS]) {
      divider = 3;
      suffix = Suffix.THOUSANDS;
    }
  } else if (amount < 1_000_000_000n) {
    if (mergedShorthands[Suffix.MILLIONS]) {
      divider = 6;
      suffix = Suffix.MILLIONS;
    }
  } else if (amount < 1_000_000_000_000n) {
    if (mergedShorthands[Suffix.BILLIONS]) {
      divider = 9;
      suffix = Suffix.BILLIONS;
    }
  } else {
    if (mergedShorthands[Suffix.TRILLIONS]) {
      divider = 12;
      suffix = Suffix.TRILLIONS;
    }
  }

  const value = amountToString(amount, precision + divider);

  return {
    value,
    suffix,
    formatted: intl.format(parseInt(value)) + suffix,
  };
}
