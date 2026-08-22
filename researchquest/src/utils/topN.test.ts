import { describe, it, expect } from 'vitest';
import { getTopN } from './collections';

describe('getTopN logic', () => {
  it('matches sort and slice for descending', () => {
    const items = [
      { id: 1, val: 10 },
      { id: 2, val: 50 },
      { id: 3, val: 20 },
      { id: 4, val: 40 },
      { id: 5, val: 30 },
    ];
    const compareDesc = (a: any, b: any) => b.val > a.val ? 1 : b.val < a.val ? -1 : 0;

    const expected = [...items].sort(compareDesc).slice(0, 3);
    const actual = getTopN(items, 3, compareDesc);
    expect(actual).toEqual(expected);
  });
});
