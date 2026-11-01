import { describe, expect, it } from "vitest";
import {
  effectivePaidPercentage,
  paidChapterWeights,
  unlockedChapterCount,
  unlockedChapterIds,
} from "./installmentAccess";

// Paid (non-preview) lessons per chapter, taken from live courses
const ORGANIC = [5, 3, 2, 1, 1, 1, 1]; // Organic Chemistry: 14 paid lessons
const GENERAL = [4, 1, 2, 2, 2, 1]; // General Chemistry: 12 paid lessons

describe("unlockedChapterCount", () => {
  it("opens about a third of the content for 1/3", () => {
    expect(unlockedChapterCount(33, ORGANIC)).toBe(1); // 5/14 lessons
    expect(unlockedChapterCount(33, GENERAL)).toBe(1); // 4/12 lessons
  });

  it("opens about two thirds of the content for 2/3", () => {
    expect(unlockedChapterCount(66, ORGANIC)).toBe(3); // 10/14 lessons
    expect(unlockedChapterCount(66, GENERAL)).toBe(3); // 7/12 lessons
  });

  it("opens everything only for a full payment", () => {
    expect(unlockedChapterCount(100, ORGANIC)).toBe(7);
    expect(unlockedChapterCount(99.9, [1, 1, 10])).toBeLessThan(3);
  });

  it("opens nothing without payment and at least one chapter for any payment", () => {
    expect(unlockedChapterCount(0, ORGANIC)).toBe(0);
    expect(unlockedChapterCount(1, ORGANIC)).toBe(1);
    expect(unlockedChapterCount(50, [])).toBe(0);
  });

  it("never decreases as more is paid", () => {
    for (const w of [ORGANIC, GENERAL, [1, 1, 10], [10, 1, 1], [3, 3]]) {
      let prev = 0;
      for (let pct = 0; pct <= 100; pct++) {
        const k = unlockedChapterCount(pct, w);
        expect(k).toBeGreaterThanOrEqual(prev);
        prev = k;
      }
    }
  });
});

describe("unlockedChapterIds", () => {
  const chapters = [
    { id: "c", sort_order: 3 },
    { id: "intro", sort_order: 1 },
    { id: "b", sort_order: 2 },
  ];
  const lessons = [
    { chapter_id: "intro", is_preview: true },
    ...Array(7).fill({ chapter_id: "b", is_preview: false }),
    ...Array(4).fill({ chapter_id: "c", is_preview: false }),
  ];

  it("skips preview-only chapters and follows chapter order", () => {
    expect(paidChapterWeights(chapters, lessons).map((c) => c.id)).toEqual(["b", "c"]);
    expect([...unlockedChapterIds(33, chapters, lessons)]).toEqual(["b"]);
    expect([...unlockedChapterIds(100, chapters, lessons)]).toEqual(["b", "c"]);
  });

  it("keeps the access a student already had under the previous rule", () => {
    expect([...unlockedChapterIds(33, chapters, lessons, 2)]).toEqual(["b", "c"]);
    expect([...unlockedChapterIds(33, chapters, lessons, null)]).toEqual(["b"]);
    expect([...unlockedChapterIds(0, chapters, lessons, 2)]).toEqual([]);
  });
});

describe("effectivePaidPercentage", () => {
  it("uses the highest of the enrollment and the paid installments", () => {
    expect(effectivePaidPercentage(33, [{ installment_plan: { new_paid_percentage: 66 } }])).toBe(66);
    expect(effectivePaidPercentage(50, [{ installment_plan: { is_bundle: true } }])).toBe(50);
  });

  it("does not add installments up (33% then 66% is 66%, not 99%)", () => {
    expect(
      effectivePaidPercentage(0, [
        { installment_plan: { installment_percent: 33, new_paid_percentage: 33 } },
        { installment_plan: { installment_percent: 66, new_paid_percentage: 66 } },
      ]),
    ).toBe(66);
  });

  it("treats a paid payment without a plan as full, and 2/3 rounding as full", () => {
    expect(effectivePaidPercentage(0, [{ installment_plan: null }])).toBe(100);
    expect(effectivePaidPercentage(99.6, [])).toBe(100);
  });
});
