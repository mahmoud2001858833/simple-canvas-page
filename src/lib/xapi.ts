import { supabase } from "@/integrations/supabase/client";

export type XapiVerb =
  | "registered"
  | "initialized"
  | "watched"
  | "completed"
  | "attempted"
  | "progressed"
  | "rated"
  | "earned";

export interface XapiPayload {
  verb: XapiVerb;
  courseId?: string;
  lessonId?: string;
  quizId?: string;
  objectName?: string;
  durationSeconds?: number;
  score?: { raw?: number; min?: number; max?: number; scaled?: number };
  response?: string;
  completion?: boolean;
  success?: boolean;
  attemptId?: number;
  certificateUrl?: string;
  targetUserId?: string;
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
