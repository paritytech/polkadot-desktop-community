import { amountToShortenString, amountToString } from './formatAmount';

describe('formatAmount', () => {
  describe('amountToString', () => {
    it.each([
      {
        amount: 1000n,
        precision: 2,
        result: '10',
      },
      {
        amount: 1000n,
        precision: 0,
        result: '1,000',
      },
      {
        amount: 1n,
        precision: 2,
        result: '0.01',
      },
    ])('should format $amount with precision $precision', ({ amount, precision, result }) => {
      expect(amountToString(amount, precision)).toBe(result);
    });
  });

  describe('amountToShortenString', () => {
    it.each([
      {
        amount: 1000n,
        precision: 2,
        result: '10',
      },
      {
        amount: 10_000_000n,
        precision: 0,
        result: '10M',
      },
    ])('should format $amount with precision $precision', ({ amount, precision, result }) => {
      expect(amountToShortenString(amount, precision).formatted).toBe(result);
    });
  });
});
