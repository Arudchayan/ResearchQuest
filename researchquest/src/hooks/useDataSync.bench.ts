import { bench, describe } from 'vitest';

const ITEMS_COUNT = 1000;
const data = Array.from({ length: ITEMS_COUNT }, (_, i) => ({ id: `id-${i}`, value: i }));
const targetId = `id-${ITEMS_COUNT - 1}`; // worst case for find

describe('Array.find vs Map lookup (Single Lookup)', () => {
  bench('Array.find', () => {
    const fresh = data.find(item => item.id === targetId);
  });

  bench('Map creation + lookup', () => {
    const map = new Map(data.map(item => [item.id, item]));
    const fresh = map.get(targetId);
  });
});
