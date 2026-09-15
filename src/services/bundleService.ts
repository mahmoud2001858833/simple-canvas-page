import { supabase } from "@/integrations/supabase/client";

export interface CourseBundle {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  price: number;
  original_price: number | null;
  discount_percentage: number | null;
  thumbnail_url: string | null;
  is_active: boolean;
  valid_days: number | null;
  created_at: string;
  updated_at: string;
  courses?: {
    id: string;
    title: string;
    title_ar: string;
    price: number | null;
    original_price: number | null;
    thumbnail_url: string | null;
    instructor_id: string | null;
    instructor_commission: number | null;
    instructor_name?: string;
  }[];
  purchases_count?: number;
}

export interface CustomBundleSettings {
  min_courses: number;
  discount_percentage: number;
  is_enabled: boolean;
}

export const DEFAULT_BUNDLE_SETTINGS: CustomBundleSettings = {
  min_courses: 4,
  discount_percentage: 25,
  is_enabled: true,
};

/**
 * Fetch platform custom bundle settings from platform_settings
 */
export async function getCustomBundleSettings(): Promise<CustomBundleSettings> {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "custom_bundle_settings")
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_BUNDLE_SETTINGS;
    }

    const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return {
      min_courses: Number(parsed?.min_courses) || DEFAULT_BUNDLE_SETTINGS.min_courses,
      discount_percentage: Number(parsed?.discount_percentage) || DEFAULT_BUNDLE_SETTINGS.discount_percentage,
      is_enabled: parsed?.is_enabled !== undefined ? Boolean(parsed.is_enabled) : DEFAULT_BUNDLE_SETTINGS.is_enabled,
    };
  } catch (e) {
    console.error("Error fetching custom bundle settings:", e);
    return DEFAULT_BUNDLE_SETTINGS;
  }
}

/**
 * Save custom bundle rules to platform_settings
 */
export async function saveCustomBundleSettings(settings: CustomBundleSettings): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("platform_settings")
      .upsert({
        key: "custom_bundle_settings",
        value: JSON.stringify(settings),
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error saving custom bundle settings:", e);
    throw e;
  }
}

/**
 * Fetch all active public bundles with their associated courses and instructor info
 */
export async function getActiveBundles(): Promise<CourseBundle[]> {
  try {
    const { data: bundles, error } = await supabase
      .from("course_bundles")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!bundles || bundles.length === 0) return [];

    return await populateBundleDetails(bundles);
  } catch (e) {
    console.error("Error fetching active bundles:", e);
    return [];
  }
}

/**
 * Fetch all bundles for admin (including inactive ones)
 */
export async function getAllBundles(): Promise<CourseBundle[]> {
  try {
    const { data: bundles, error } = await supabase
      .from("course_bundles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!bundles || bundles.length === 0) return [];

    return await populateBundleDetails(bundles);
  } catch (e) {
    console.error("Error fetching all bundles for admin:", e);
    return [];
  }
}

/**
 * Helper to join courses and purchase counts for bundles
 */
async function populateBundleDetails(bundles: any[]): Promise<CourseBundle[]> {
  const bundleIds = bundles.map(b => b.id);

  // Fetch bundle courses
  const { data: bundleCoursesRel, error: relErr } = await supabase
    .from("bundle_courses")
    .select(`
      bundle_id,
      sort_order,
      courses:course_id (
        id,
        title,
        title_ar,
        price,
        original_price,
        thumbnail_url,
        instructor_id,
        instructor_commission
      )
    `)
    .in("bundle_id", bundleIds);

  if (relErr) {
    console.error("Error fetching bundle courses relation:", relErr);
  }

  // Fetch purchases count
  const { data: purchases, error: purchErr } = await supabase
    .from("bundle_purchases")
    .select("bundle_id")
    .in("bundle_id", bundleIds);

  if (purchErr) {
    console.error("Error fetching bundle purchases count:", purchErr);
  }

  // Fetch instructors profiles for instructors in these courses
  const instructorIds = new Set<string>();
  (bundleCoursesRel || []).forEach((rel: any) => {
    if (rel.courses?.instructor_id) {
      instructorIds.add(rel.courses.instructor_id);
    }
  });

  let instructorMap: Record<string, string> = {};
  if (instructorIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, full_name_ar")
      .in("id", Array.from(instructorIds));

    (profiles || []).forEach((p: any) => {
      instructorMap[p.id] = p.full_name_ar || p.full_name || "معلم معتمد";
    });
  }

  return bundles.map(b => {
    const rels = (bundleCoursesRel || []).filter((r: any) => r.bundle_id === b.id);
    const sortedCourses = rels
      .filter((r: any) => r.courses)
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((r: any) => ({
        ...r.courses,
        instructor_name: r.courses.instructor_id ? instructorMap[r.courses.instructor_id] : undefined,
      }));

    const purchasesCount = (purchases || []).filter((p: any) => p.bundle_id === b.id).length;

    return {
      ...b,
      courses: sortedCourses,
      purchases_count: purchasesCount,
    };
  });
}

/**
 * Create a new course bundle with courses
 */
export async function createCourseBundle(data: {
  title: string;
  title_ar: string;
  description?: string;
  description_ar?: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  thumbnail_url?: string;
  is_active?: boolean;
  valid_days?: number;
  course_ids: string[];
}): Promise<string> {
  const { course_ids, ...bundleFields } = data;

  const { data: inserted, error: insertErr } = await supabase
    .from("course_bundles")
    .insert({
      title: bundleFields.title,
      title_ar: bundleFields.title_ar,
      description: bundleFields.description || null,
      description_ar: bundleFields.description_ar || null,
      price: bundleFields.price,
      original_price: bundleFields.original_price,
      discount_percentage: bundleFields.discount_percentage,
      thumbnail_url: bundleFields.thumbnail_url || null,
      is_active: bundleFields.is_active ?? true,
      valid_days: bundleFields.valid_days || null,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  const bundleId = inserted.id;

  if (course_ids.length > 0) {
    const relations = course_ids.map((courseId, idx) => ({
      bundle_id: bundleId,
      course_id: courseId,
      sort_order: idx + 1,
    }));

    const { error: relErr } = await supabase.from("bundle_courses").insert(relations);
    if (relErr) throw relErr;
  }

  return bundleId;
}

/**
 * Update an existing course bundle
 */
export async function updateCourseBundle(
  bundleId: string,
  data: {
    title?: string;
    title_ar?: string;
    description?: string;
    description_ar?: string;
    price?: number;
    original_price?: number;
    discount_percentage?: number;
    thumbnail_url?: string;
    is_active?: boolean;
    valid_days?: number;
    course_ids?: string[];
  }
): Promise<void> {
  const { course_ids, ...bundleFields } = data;

  if (Object.keys(bundleFields).length > 0) {
    const { error: updateErr } = await supabase
      .from("course_bundles")
      .update(bundleFields)
      .eq("id", bundleId);

    if (updateErr) throw updateErr;
  }

  if (course_ids !== undefined) {
    // Delete old relations and insert new ones
    await supabase.from("bundle_courses").delete().eq("bundle_id", bundleId);

    if (course_ids.length > 0) {
      const relations = course_ids.map((courseId, idx) => ({
        bundle_id: bundleId,
        course_id: courseId,
        sort_order: idx + 1,
      }));
      const { error: relErr } = await supabase.from("bundle_courses").insert(relations);
      if (relErr) throw relErr;
    }
  }
}

/**
 * Delete a bundle
 */
export async function deleteCourseBundle(bundleId: string): Promise<void> {
  // Delete course relations first
  await supabase.from("bundle_courses").delete().eq("bundle_id", bundleId);
  const { error } = await supabase.from("course_bundles").delete().eq("id", bundleId);
  if (error) throw error;
}

/**
 * Process a bundle purchase:
 * 1. Inserts into bundle_purchases
 * 2. Unlocks/upserts enrollments for ALL courses with paid_percentage = 100
 * 3. Records itemized payments for each course with bundle indicator
 * 4. Credits instructor_earnings for each course instructor based on the discounted price
 */
export async function processBundleCheckout(params: {
  userId: string;
  userEmail?: string;
  bundleId?: string;
  bundleTitle: string;
  bundleTitleAr: string;
  totalPrice: number;
  originalPrice: number;
  discountPercentage: number;
  courses: {
    id: string;
    title: string;
    title_ar: string;
    price: number | null;
    instructor_id: string | null;
    instructor_commission?: number | null;
  }[];
  paymentMethod?: "online" | "bank_transfer" | "apple_pay" | "stc_pay" | "free_coupon" | "tamara" | "tabby" | "alinmapay" | "wallet";
  isCustomBundle?: boolean;
}): Promise<{
  success: boolean;
  bundlePurchaseId: string;
  unlockedCoursesCount: number;
  courseIds: string[];
}> {
  const {
    userId,
    userEmail,
    bundleId,
    bundleTitle,
    bundleTitleAr,
    totalPrice,
    originalPrice,
    discountPercentage,
    courses,
    paymentMethod = "online",
    isCustomBundle = false,
  } = params;

  if (courses.length === 0) {
    throw new Error("لا توجد مواد محددة في هذا البكج");
  }

  let resolvedBundleId = bundleId;

  // If this is a student custom-built bundle, create a course_bundles record to maintain relational integrity
  if (isCustomBundle || !resolvedBundleId) {
    const { data: newBundle, error: createBundleErr } = await supabase
      .from("course_bundles")
      .insert({
        title: bundleTitle || `Custom Bundle (${courses.length} courses)`,
        title_ar: bundleTitleAr || `بكج مخصص (${courses.length} مواد)`,
        price: totalPrice,
        original_price: originalPrice,
        discount_percentage: discountPercentage,
        is_active: false, // private student bundle
      })
      .select("id")
      .single();

    if (createBundleErr) {
      console.error("Error creating custom bundle record:", createBundleErr);
    } else {
      resolvedBundleId = newBundle.id;
      // Link courses
      const links = courses.map((c, i) => ({
        bundle_id: resolvedBundleId!,
        course_id: c.id,
        sort_order: i + 1,
      }));
      await supabase.from("bundle_courses").insert(links);
    }
  }

  const transactionGroupId = `BNDL_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Calculate prorated price for each course
  const totalOriginalCoursePrice = courses.reduce((sum, c) => sum + (Number(c.price) || 0), 0);

  const courseIds: string[] = [];

  for (const course of courses) {
    courseIds.push(course.id);
    const courseOriginalPrice = Number(course.price) || (originalPrice / courses.length);
    
    // Effective discounted price for this course
    let effectiveCoursePrice = 0;
    if (totalOriginalCoursePrice > 0) {
      effectiveCoursePrice = Math.round((courseOriginalPrice / totalOriginalCoursePrice) * totalPrice * 100) / 100;
    } else {
      effectiveCoursePrice = Math.round((totalPrice / courses.length) * 100) / 100;
    }

    const noteText = isCustomBundle
      ? `شراء باقة مخصصة (${courses.length} مواد) - ${course.title_ar || course.title}`
      : `شراء باقة: ${bundleTitleAr || bundleTitle} - ${course.title_ar || course.title}`;

    const installmentPlanMetadata = {
      is_bundle: true,
      bundle_id: resolvedBundleId || null,
      bundle_title: bundleTitleAr || bundleTitle,
      bundle_type: isCustomBundle ? "custom" : "prebuilt",
      bundle_total: totalPrice,
      bundle_original_total: originalPrice,
      discount_percentage: discountPercentage,
      course_original_price: courseOriginalPrice,
      course_bundle_price: effectiveCoursePrice,
      transaction_group: transactionGroupId,
    };

    // Insert payment record
    const { data: paymentRecord, error: payErr } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        course_id: course.id,
        amount: effectiveCoursePrice,
        payment_method: paymentMethod as any,
        status: "paid",
        paid_at: new Date().toISOString(),
        transaction_id: `${transactionGroupId}_${course.id.substring(0, 4)}`,
        notes: noteText,
        installment_plan: installmentPlanMetadata as any,
      })
      .select("id")
      .single();

    if (payErr) {
      console.error("Error inserting itemized bundle payment:", payErr);
    }

    // Upsert enrollment with 100% access
    const { error: enrollErr } = await supabase
      .from("enrollments")
      .upsert({
        user_id: userId,
        course_id: course.id,
        status: "active",
        paid_percentage: 100,
        enrolled_at: new Date().toISOString(),
      }, { onConflict: "user_id,course_id" });

    if (enrollErr) {
      console.error(`Error enrolling user in course ${course.id}:`, enrollErr);
    }

    // Credit instructor earnings based on the discounted bundle price
    if (course.instructor_id) {
      const commissionRate = Number(course.instructor_commission) || 30;
      const teacherEarning = Math.round(effectiveCoursePrice * (commissionRate / 100) * 100) / 100;

      const { error: earnErr } = await supabase
        .from("instructor_earnings")
        .insert({
          instructor_id: course.instructor_id,
          course_id: course.id,
          amount: teacherEarning,
          commission_rate: commissionRate,
          status: "pending",
          payment_id: paymentRecord?.id || null,
        });

      if (earnErr) {
        console.error(`Error recording instructor earning for course ${course.id}:`, earnErr);
      }
    }
  }

  // Record bundle purchase
  let bundlePurchaseId = "";
  if (resolvedBundleId) {
    const { data: bPurch, error: bPurchErr } = await supabase
      .from("bundle_purchases")
      .insert({
        bundle_id: resolvedBundleId,
        user_id: userId,
        amount_paid: totalPrice,
        status: "completed",
        purchased_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (bPurchErr) {
      console.error("Error recording bundle_purchase:", bPurchErr);
    } else {
      bundlePurchaseId = bPurch?.id || "";
    }
  }

  return {
    success: true,
    bundlePurchaseId,
    unlockedCoursesCount: courses.length,
    courseIds,
  };
}
