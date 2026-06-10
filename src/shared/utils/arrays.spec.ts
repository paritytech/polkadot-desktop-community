import { mergeArrays, splice } from './arrays';

describe('Arrays utils', () => {
  test('should insert element in the beginning', () => {
    const array = splice([1, 2, 3], 100, 0);
    expect(array).toEqual([100, 2, 3]);
  });

  test('should insert element at the end', () => {
    const array = splice([1, 2, 3], 100, 2);
    expect(array).toEqual([1, 2, 100]);
  });

  test('should insert element in the middle', () => {
    const array = splice([1, 2, 3], 100, 1);
    expect(array).toEqual([1, 100, 3]);
  });

  test('should insert element in empty array', () => {
    const array1 = splice([], 100, 0);
    const array2 = splice([], 100, 1);

    expect(array1).toEqual([100]);
    expect(array2).toEqual([100]);
  });
});

describe('merge', () => {
  test('should array of strings', () => {
    const list1 = ['1', '2', '3', '4'];
    const list2 = ['2', '5'];

    const res = mergeArrays({
      a: list1,
      b: list2,
      mergeBy: s => s,
    });
    expect(res).toEqual(['1', '2', '3', '4', '5']);
  });

  test('should return first array if second is empty', () => {
    const list1 = ['1', '2', '3', '4'];

    const res = mergeArrays({
      a: list1,
      b: [],
      mergeBy: s => s,
    });
    expect(res).toBe(list1);
  });

  test('should return second array if first is empty', () => {
    const list2 = ['1', '2', '3', '4'];

    const res = mergeArrays({
      a: [],
      b: list2,
      mergeBy: s => s,
    });
    expect(res).toBe(list2);
  });

  test('should sort', () => {
    const list1 = [2, 4, 3];
    const list2 = [1, 5];

    const res = mergeArrays({
      a: list1,
      b: list2,
      mergeBy: s => s,
      sort: (a, b) => a - b,
    });
    expect(res).toEqual([1, 2, 3, 4, 5]);
  });

  test('should replace objects', () => {
    const list1 = [{ id: 1 }, { id: 4 }, { id: 5 }];
    const list2 = [{ id: 3 }, { id: 2 }, { id: 3, test: true }, { id: 6 }, { id: 7 }];

    const res = mergeArrays({
      a: list1,
      b: list2,
      mergeBy: s => s.id,
    });
    expect(res).toEqual([{ id: 1 }, { id: 2 }, { id: 3, test: true }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }]);
  });

  test('should merge objects', () => {
    const list1 = [{ id: 1, v: 1 }, { id: 5 }];
    const list2 = [{ id: 3 }, { id: 1, v: 2 }];

    const res = mergeArrays({
      a: list1,
      b: list2,
      mergeBy: s => s.id,
      merge: (a, b) => ({ ...a, v: (a.v ?? 0) + (b.v ?? 0) }),
    });
    expect(res).toEqual([{ id: 1, v: 3 }, { id: 3 }, { id: 5 }]);
  });

  test('should replace and sort objects', () => {
    const list1 = [{ id: 1 }, { id: 5 }, { id: 4 }];
    const list2 = [{ id: 3 }, { id: 2 }];

    const res = mergeArrays({
      a: list1,
      b: list2,
      mergeBy: s => s.id,
      sort: (a, b) => b.id - a.id,
    });
    expect(res).toEqual([{ id: 5 }, { id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]);
  });

  test('should sort objects by complex value', () => {
    const list1 = [
      { id: 1, date: new Date(1) },
      { id: 5, date: new Date(5) },
      { id: 4, date: new Date(4) },
    ];
    const list2 = [
      { id: 3, date: new Date(3) },
      { id: 2, date: new Date(2) },
    ];

    const res = mergeArrays({
      a: list1,
      b: list2,
      mergeBy: s => s.id,
      sort: (a, b) => a.date.getTime() - b.date.getTime(),
    });
    expect(res).toEqual([
      { id: 1, date: new Date(1) },
      { id: 2, date: new Date(2) },
      { id: 3, date: new Date(3) },
      { id: 4, date: new Date(4) },
      { id: 5, date: new Date(5) },
    ]);
  });
});
