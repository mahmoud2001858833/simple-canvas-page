// NELC / FutureX xAPI (LRS) integration
// Sends learning statements to the National eLearning Center LRS
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LRS_ENDPOINT = Deno.env.get("NELC_LRS_ENDPOINT") ?? "";
const LRS_USER = Deno.env.get("NELC_LRS_USERNAME") ?? "";
const LRS_PASS = Deno.env.get("NELC_LRS_PASSWORD") ?? "";
const PLATFORM = Deno.env.get("NELC_PLATFORM_URL") ?? "https://josoorcom.com";

const PLATFORM_NAME = {
  "ar-SA": "جسوركم",
  "en-US": "Josoorcom",
};

const VERBS: Record<string, { id: string; display: string }> = {
  registered: { id: "http://adlnet.gov/expapi/verbs/registered", display: "registered" },
  initialized: { id: "http://adlnet.gov/expapi/verbs/initialized", display: "initialized" },
  watched: { id: "https://w3id.org/xapi/acrossx/verbs/watched", display: "watched" },
  completed: { id: "http://adlnet.gov/expapi/verbs/completed", display: "completed" },
  attempted: { id: "http://adlnet.gov/expapi/verbs/attempted", display: "attempted" },
  progressed: { id: "http://adlnet.gov/expapi/verbs/progressed", display: "progressed" },
  rated: { id: "http://id.tincanapi.com/verb/rated", display: "rated" },
  earned: { id: "http://id.tincanapi.com/verb/earned", display: "earned" },
};

const COURSE_TYPE = "https://w3id.org/xapi/cmi5/activitytype/course";
const VIDEO_TYPE = "https://w3id.org/xapi/video/activity-type/video";
const QUIZ_TYPE = "http://id.tincanapi.com/activitytype/unit-test";
const BADGE_TYPE = "http://activitystrea.ms/schema/1.0/badge";

function iso8601Duration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PT${pad(h)}H${pad(m)}M${pad(sec)}S`;
}

function courseActivity(courseId: string, name: string) {
  return {
    id: `${PLATFORM}/courses/${courseId}`,
    definition: {
      name: { "en-US": name },
      type: COURSE_TYPE,
    },
    objectType: "Activity",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LRS_ENDPOINT || !LRS_USER || !LRS_PASS) {
      return new Response(JSON.stringify({ error: "LRS not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      verb,
      courseId,
      lessonId,
      quizId,
      objectName,
      durationSeconds,
      score, // { raw, min, max, scaled }
      response: userResponse,
      completion,
      success: resultSuccess,
      attemptId,
      certificateUrl,
      targetUserId,
    } = body ?? {};

    if (!VERBS[verb]) {
      return new Response(JSON.stringify({ error: "Unknown verb" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins may send statements on behalf of another learner
    let actorUserId = user.id;
    if (targetUserId && targetUserId !== user.id) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      actorUserId = targetUserId;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, full_name_ar, email, national_id, preferred_language")
      .eq("id", actorUserId)
      .maybeSingle();

    const email = profile?.email || user.email || `${actorUserId}@josoorcom.com`;
    const actorName = profile?.national_id || profile?.full_name || email.split("@")[0];

    const actor = {
      mbox: `mailto:${email}`,
      name: String(actorName),
      objectType: "Agent",
    };

    // Course + instructor info
    let courseName = objectName || "Course";
    let courseDurationSeconds = 0;
    let instructor: { name: string; mbox: string } | undefined;

    if (courseId) {
      const { data: course } = await supabase
        .from("courses")
        .select("id, title, title_ar, description, duration_hours, instructor_id")
        .eq("id", courseId)
        .maybeSingle();

      if (course) {
        courseName = course.title || course.title_ar || courseName;
        courseDurationSeconds = (Number(course.duration_hours) || 0) * 3600;
        if (course.instructor_id) {
          const { data: inst } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", course.instructor_id)
            .maybeSingle();
          if (inst?.email) {
            instructor = { name: inst.full_name || "Instructor", mbox: `mailto:${inst.email}` };
          }
        }
      }
    }

    const parentCourse = courseId ? courseActivity(courseId, courseName) : null;

    // Build object
    let object: Record<string, unknown>;
    if (verb === "watched" && lessonId) {
      object = {
        id: `${PLATFORM}/courses/${courseId}/lesson/${lessonId}`,
        definition: {
          name: { "en-US": objectName || `${courseName} - Lesson` },
          type: VIDEO_TYPE,
        },
        objectType: "Activity",
      };
    } else if (verb === "attempted" && quizId) {
      object = {
        id: `${PLATFORM}/courses/${courseId}/quiz/${quizId}`,
        definition: {
          name: { "en-US": objectName || `${courseName} - Quiz` },
          type: QUIZ_TYPE,
        },
        objectType: "Activity",
      };
    } else if (verb === "earned") {
      object = {
        id: `${PLATFORM}/courses/${courseId}/certificate`,
        definition: {
          name: { "en-US": objectName || `${courseName} Certificate` },
          type: BADGE_TYPE,
        },
        objectType: "Activity",
      };
    } else {
      object = parentCourse ?? {
        id: `${PLATFORM}/courses/`,
        definition: { name: { "en-US": courseName }, type: COURSE_TYPE },
        objectType: "Activity",
      };
    }

    // Build context
    const context: Record<string, unknown> = {
      platform: PLATFORM,
      language: profile?.preferred_language === "en" ? "en-US" : "ar-SA",
      extensions: {
        "https://nelc.gov.sa/extensions/platform": { name: PLATFORM_NAME },
      } as Record<string, unknown>,
    };

    if (instructor) context.instructor = instructor;

    if (verb === "registered") {
      (context.extensions as Record<string, unknown>)["https://nelc.gov.sa/extensions/duration"] =
        iso8601Duration(courseDurationSeconds || 3600);
      (context.extensions as Record<string, unknown>)["https://nelc.gov.sa/extensions/lms_url"] = PLATFORM;
      (context.extensions as Record<string, unknown>)["https://nelc.gov.sa/extensions/program_url"] =
        `${PLATFORM}/courses/${courseId ?? ""}`;
    }

    if (verb === "attempted") {
      (context.extensions as Record<string, unknown>)["http://id.tincanapi.com/extension/attempt-id"] =
        attemptId ?? 1;
    }

    if (verb === "earned" && certificateUrl) {
      (context.extensions as Record<string, unknown>)[
        "http://id.tincanapi.com/extension/jws-certificate-location"
      ] = certificateUrl;
    }

    if (parentCourse && ["watched", "attempted", "earned"].includes(verb)) {
      context.contextActivities = { parent: [parentCourse] };
    }

    // Build result
    let result: Record<string, unknown> | undefined;
    if (typeof durationSeconds === "number" || score || typeof completion === "boolean" || userResponse) {
      result = {};
      if (typeof completion === "boolean") result.completion = completion;
      if (typeof resultSuccess === "boolean") result.success = resultSuccess;
      if (typeof durationSeconds === "number") result.duration = iso8601Duration(durationSeconds);
      if (score) result.score = score;
      if (userResponse) result.response = userResponse;
      if (Object.keys(result).length === 0) result = undefined;
    }

    const statement: Record<string, unknown> = {
      actor,
      verb: {
        id: VERBS[verb].id,
        display: { "en-US": VERBS[verb].display },
      },
      object,
      context,
      timestamp: new Date().toISOString(),
    };
    if (result) statement.result = result;

    const lrsRes = await fetch(LRS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Experience-API-Version": "1.0.3",
        Authorization: "Basic " + btoa(`${LRS_USER}:${LRS_PASS}`),
      },
      body: JSON.stringify(statement),
    });

    const text = await lrsRes.text();

    await supabase.from("xapi_statements").insert({
      user_id: actorUserId,
      verb,
      course_id: courseId ?? null,
      statement,
      status_code: lrsRes.status,
      response: text.slice(0, 2000),
      success: lrsRes.ok,
    });

    return new Response(
      JSON.stringify({ ok: lrsRes.ok, status: lrsRes.status, response: text.slice(0, 1000), statement }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("xapi-track error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
