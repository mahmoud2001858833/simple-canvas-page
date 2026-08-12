import { supabase } from "@/integrations/supabase/client";

export type XapiVerb =
  | "registered"
  | "initialized"
  | "watched"
  | "completed"
  | "attended"
  | "attempted"
  | "progressed"
  | "rated"
  | "earned";

export type XapiObjectKind =
  | "course"
  | "module"
  | "lesson"
  | "video"
  | "quiz"
  | "assessment"
  | "assignment"
  | "virtual-classroom"
  | "certificate";

export interface XapiPayload {
  verb: XapiVerb;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  quizId?: string;
  objectKind?: XapiObjectKind;
  objectName?: string;
  objectDescription?: string;
  durationSeconds?: number;
  score?: { raw?: number; min?: number; max?: number; scaled?: number };
  response?: string;
  completion?: boolean;
  success?: boolean;
  attemptId?: number;
  certificateUrl?: string;
  targetUserId?: string;
  allowDuplicate?: boolean;
}

/** National ID must be 10 digits and start with 1, 2 or 4 (NELC rule). */
export function isValidNationalId(value: string) {
  return /^[124]\d{9}$/.test((value || "").trim());
}

/**
 * Sends an xAPI statement to the NELC LRS (fire and forget).
 * Failures are silent so learning flows are never blocked.
 */
export async function trackXapi(payload: XapiPayload) {
  try {
    const { data, error } = await supabase.functions.invoke("xapi-track", { body: payload });
    if (error) console.warn("xAPI track failed", error.message);
    return data;
  } catch (e) {
    console.warn("xAPI track error", e);
    return null;
  }
}
