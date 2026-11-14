import { describe, expect, test } from "vitest";
import { seededRng } from "./rng.js";

describe("seededRng", () => {
  test("replays the same numbers for the same seed", () => {
    const first = seededRng("une graine");
    const second = seededRng("une graine");
    for (let draw = 0; draw < 200; draw += 1) {
      expect(second.next()).toBe(first.next());
    }
  });

  test("gives other numbers for another seed", () => {
    const first = seededRng("1");
    const second = seededRng("2");
    const same = Array.from({ length: 20 }, () => first.next() === second.next());
    expect(same.filter(Boolean)).toHaveLength(0);
  });

  test("stays in [0, 1) and covers it", () => {
    const rng = seededRng("7804448558973285409");
    const tenths = new Array<number>(10).fill(0);
    for (let draw = 0; draw < 10_000; draw += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      tenths[Math.floor(value * 10)]! += 1;
    }
    for (const count of tenths) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  // A replayed life depends on these numbers. If this fails, the algorithm changed.
  test("keeps the sequence it had when lives were first recorded", () => {
    const rng = seededRng("7804448558973285409");
    expect([rng.next(), rng.next(), rng.next(), rng.next()]).toEqual([
      0.41221849992871284, 0.45973224961198866, 0.62501225550659, 0.7904925821349025,
    ]);
    const empty = seededRng("");
    expect([empty.next(), empty.next()]).toEqual([0.18176812469027936, 0.3188686918001622]);
  });
});
