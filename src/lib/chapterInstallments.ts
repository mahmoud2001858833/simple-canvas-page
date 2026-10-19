// Chapter-based installments: a course with N chapters is paid in N payments.
// Paying k payments unlocks the first k chapters (by sort_order).
//
// paid_percentage stays the single stored number (so the DB triggers keep working),
// but it is always derived from "k of N" and read back with the same helper, so
// there is no rounding drift (e.g. 66.6667% of 3 chapters is exactly 2 chapters).
//
// KEEP IN SYNC with supabase/functions/create-alinma-payment/index.ts (same formulas).

/** Number of chapters unlocked by a stored paid percentage. */
export function unlockedChapters(paidPercentage: number | null | undefined, totalChapters: number): number {
  const n = Math.max(1, Math.floor(totalChapters || 1));
  const pct = Number(paidPercentage ?? 0);
  if (!(pct > 0)) return 0;
  if (pct >= 99.99) return n;
  // The small epsilon keeps 66.6667% of 3 chapters at 2 (not 3), and still maps the old
  // fixed plans (33% / 66%) to the same chapters as before.
  return Math.min(n, Math.max(0, Math.ceil((pct / 100) * n - 0.01)));
}

/** Stored paid percentage after paying for the first k chapters. */
export function percentForChapters(k: number, totalChapters: number): number {
  const n = Math.max(1, Math.floor(totalChapters || 1));
  if (k >= n) return 100;
  return Math.round((k / n) * 100 * 10000) / 10000;
}

/** Price of going from `fromChapters` unlocked chapters to `toChapters` (whole currency units). */
export function chapterInstallmentAmount(
  totalPrice: number,
  fromChapters: number,
  toChapters: number,
  totalChapters: number,
): number {
  const n = Math.max(1, Math.floor(totalChapters || 1));
  const raw = (Number(totalPrice) * (toChapters - fromChapters)) / n;
  return Math.ceil(Math.round(raw * 100) / 100);
}

export interface ChapterInstallmentOption {
  chapters: number; // k
  percent: number; // value stored in enrollments.paid_percentage
  isFull: boolean;
}

/** One option per chapter: 1..N. A course with 0 or 1 chapters only has the full payment. */
export function buildChapterOptions(totalChapters: number): ChapterInstallmentOption[] {
  const n = Math.floor(totalChapters || 0);
  if (n < 2) return [{ chapters: Math.max(1, n), percent: 100, isFull: true }];
  return Array.from({ length: n }, (_, i) => ({
    chapters: i + 1,
    percent: percentForChapters(i + 1, n),
    isFull: i + 1 === n,
  }));
}
