// Chapter unlocking for installment (partial) payments.
//
// A paid percentage unlocks whole chapters, in course order, whose share of the course's
// paid (non-preview) lessons is closest to that percentage. This keeps "pay 1/3" close to
// a third of the actual content even when chapters differ a lot in size.
// Chapters that contain only preview lessons are free and never count towards the quota.

export interface InstallmentChapter {
  id: string;
  sort_order?: number | null;
}

export interface InstallmentLesson {
  id?: string;
  chapter_id?: string | null;
  is_preview?: boolean | null;
}

/** Paid chapters (those with at least one non-preview lesson) in course order, with their lesson weight. */
export function paidChapterWeights(chapters: InstallmentChapter[], lessons: InstallmentLesson[]) {
  const weights = new Map<string, number>();
  for (const l of lessons) {
    if (!l.chapter_id || l.is_preview) continue;
    weights.set(l.chapter_id, (weights.get(l.chapter_id) || 0) + 1);
  }
  return [...chapters]
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .filter((ch) => weights.has(ch.id))
    .map((ch) => ({ id: ch.id, weight: weights.get(ch.id) as number }));
}

/** How many paid chapters (from the start) a paid percentage unlocks. */
export function unlockedChapterCount(paidPercentage: number, weights: number[]): number {
  const n = weights.length;
  const pct = Number(paidPercentage) || 0;
  if (n === 0 || pct <= 0) return 0;
  if (pct >= 100) return n;

  const total = weights.reduce((s, w) => s + w, 0);
  const target = (pct / 100) * total;

  // Closest cumulative share; ties go to the smaller count. A partial payment never unlocks
  // the whole course (only a full payment does), but always unlocks at least one chapter.
  let best = 1;
  let bestDiff = Infinity;
  let cum = 0;
  for (let k = 1; k <= Math.max(1, n - 1); k++) {
    cum += weights[k - 1];
    const diff = Math.abs(cum - target);
    if (diff < bestDiff - 1e-9) {
      best = k;
      bestDiff = diff;
    }
  }
  return Math.min(best, n);
}

/**
 * Ids of the paid chapters a paid percentage unlocks. `legacyChapters` is the access a student
 * already had under the previous rule (enrollments.legacy_unlocked_chapters); it is never reduced.
 */
export function unlockedChapterIds(
  paidPercentage: number,
  chapters: InstallmentChapter[],
  lessons: InstallmentLesson[],
  legacyChapters?: number | null,
): Set<string> {
  const paid = paidChapterWeights(chapters, lessons);
  const k = Math.max(
    unlockedChapterCount(paidPercentage, paid.map((c) => c.weight)),
    paidPercentage > 0 ? Number(legacyChapters) || 0 : 0,
  );
  return new Set(paid.slice(0, k).map((c) => c.id));
}

/**
 * Paid percentage of a student, from the enrollment and their paid payments for the course.
 * A paid payment without an installment plan is a full (legacy) payment.
 */
export function effectivePaidPercentage(
  enrollmentPercentage: number,
  paidPayments: { installment_plan?: Record<string, unknown> | null }[],
): number {
  let pct = Number(enrollmentPercentage) || 0;
  for (const p of paidPayments) {
    const plan = p.installment_plan;
    const planPct = plan ? Number(plan.new_paid_percentage || 0) : 100;
    pct = Math.max(pct, planPct);
  }
  // 66.67% style rounding of the last installment still means "everything"
  return pct >= 99.5 ? 100 : Math.min(100, pct);
}
