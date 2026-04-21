import { describe, it, expect } from "vitest";

function getLevelFromXPOld(totalXP: number): number {
  let level = 1;
  let xpNeeded = level * 500;

  while (totalXP >= xpNeeded) {
    level++;
    xpNeeded = level * 500;
  }

  return level;
}

function getLevelFromXPNew(totalXP: number): number {
  return Math.floor(totalXP / 500) + 1;
}

describe("Performance: getLevelFromXP", () => {
  it("verifies both implementations produce the same output", () => {
    for (let xp = 0; xp < 10000; xp += 100) {
      expect(getLevelFromXPNew(xp)).toBe(getLevelFromXPOld(xp));
    }
  });

  it("benchmarks getLevelFromXP", () => {
    const iterations = 1000000;
    const testXPs = Array.from({ length: 1000 }, (_, i) => i * 1000);

    const startOld = performance.now();
    for (let i = 0; i < iterations; i++) {
      getLevelFromXPOld(testXPs[i % 1000]);
    }
    const endOld = performance.now();
    const timeOld = endOld - startOld;

    const startNew = performance.now();
    for (let i = 0; i < iterations; i++) {
      getLevelFromXPNew(testXPs[i % 1000]);
    }
    const endNew = performance.now();
    const timeNew = endNew - startNew;

    console.log(`getLevelFromXP (${iterations} runs):`);
    console.log(`Old: ${timeOld.toFixed(2)}ms`);
    console.log(`New: ${timeNew.toFixed(2)}ms`);
    console.log(`Speedup: ${(timeOld / timeNew).toFixed(2)}x`);

    expect(timeNew).toBeLessThan(timeOld);
  });
});
