import { describe, it, expect } from 'vitest';
import { extractYear } from '../../utils/citation';

export function extractYearOld(dateString?: string): string {
  if (!dateString) return "n.d.";
  const dateYear = new Date(dateString).getFullYear();
  if (!isNaN(dateYear)) {
    return dateYear.toString();
  }
  const match = dateString.match(/\d{4}/);
  return match ? match[0] : "n.d.";
}

describe('extractYear performance', () => {
    it('should correctly parse years', () => {
        expect(extractYear("2023-10-25T12:00:00Z")).toBe("2023");
        expect(extractYear("2023")).toBe("2023");
        expect(extractYear("Oct 25, 2023")).toBe("2023");
        expect(extractYear("Published in 2024")).toBe("2024");
        expect(extractYear("No year here")).toBe("n.d.");
        expect(extractYear("")).toBe("n.d.");
        expect(extractYear(undefined)).toBe("n.d.");
    });

    it('benchmarks new vs old extractYear', () => {
        const N = 100000;
        const testCases = [
            "2023-10-25T12:00:00Z",
            "2023",
            "Oct 25, 2023",
            "Published in 2024",
            "No year here"
        ];

        let oldTime = 0;
        let newTime = 0;

        for(const t of testCases) {
            const startOld = performance.now();
            for(let i=0; i<N; i++) extractYearOld(t);
            oldTime += performance.now() - startOld;

            const startNew = performance.now();
            for(let i=0; i<N; i++) extractYear(t);
            newTime += performance.now() - startNew;
        }

        console.log(`extractYear Benchmark (N=${N} per case):`);
        console.log(`Old (Date parsing first): ${oldTime.toFixed(2)}ms`);
        console.log(`New (Fast path): ${newTime.toFixed(2)}ms`);
        console.log(`Speedup: ${(oldTime / newTime).toFixed(2)}x`);

        expect(oldTime).toBeGreaterThan(0);
        expect(newTime).toBeGreaterThan(0);
    });
});
