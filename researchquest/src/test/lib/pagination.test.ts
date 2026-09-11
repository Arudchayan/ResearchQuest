import { describe, it, expect } from "vitest";
import {
  DATA_SYNC_ROW_LIMIT,
  DEFAULT_PAGE_SIZE,
  ENTITY_PAGE_SIZE,
  pageRange,
  paginateItems,
} from "../../lib/pagination";

describe("pagination helpers", () => {
  it("exposes sane page-size budgets", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(ENTITY_PAGE_SIZE).toBe(50);
    expect(DATA_SYNC_ROW_LIMIT).toBe(1000);
  });

  it("paginateItems windows from the front", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateItems(items, 2)).toEqual([1, 2]);
    expect(paginateItems(items, 0)).toEqual([]);
    expect(paginateItems(items, 99)).toEqual(items);
  });

  it("pageRange maps pages to inclusive PostgREST ranges", () => {
    expect(pageRange(0, 20)).toEqual({ from: 0, to: 19 });
    expect(pageRange(2, 50)).toEqual({ from: 100, to: 149 });
  });
});
