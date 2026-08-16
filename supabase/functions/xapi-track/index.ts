// NELC / FutureX xAPI 1.0.3 integration
// Builds and sends learning statements to the National eLearning Center LRS
// following the official "NELC — xAPI Profiles Guidelines".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LRS_ENDPOINT = Deno.env.get("NELC_LRS_ENDPOINT") ?? "";
const LRS_USER = Deno.env.get("NELC_LRS_USERNAME") ?? "";
const LRS_PASS = Deno.env.get("NELC_LRS_PASSWORD") ?? "";
// LMS base URL used to build every object id
const LMS_URL = (Deno.env.get("NELC_PLATFORM_URL") ?? "https://josoorcom.com").replace(/\/+$/, "");
// The platform key registered with NELC. NELC confirmed that PROV-NUM is only an
// illustrative example and that for most integrated providers the value is the
// platform URL exactly as entered in the integration request form.
const PLATFORM_KEY = Deno.env.get("NELC_PLATFORM_KEY") ?? LMS_URL;

// NELC's edge blocks generic client signatures (Python-urllib, libwww-perl…) with
// HTTP 403 / errorCode 1010. An explicit, normal User-Agent is required.
export const LRS_USER_AGENT =
  Deno.env.get("NELC_USER_AGENT") ?? "JosoorcomLMS/1.0 (+https://josoorcom.com; xAPI-client)";

const PLATFORM_NAME = {
  "ar-SA": "جسوركم",
  "en-US": "Josoorcom",
};

const VERBS: Record<string, { id: string; display: string }> = {
  registered: { id: "http://adlnet.gov/expapi/verbs/registered", display: "registered" },
  initialized: { id: "http://adlnet.gov/expapi/verbs/initialized", display: "initialized" },
  watched: { id: "https://w3id.org/xapi/acrossx/verbs/watched", display: "watched" },
  completed: { id: "http://adlnet.gov/expapi/verbs/completed", display: "completed" },
  attended: { id: "http://adlnet.gov/expapi/verbs/attended", display: "attended" },
  attempted: { id: "http://adlnet.gov/expapi/verbs/attempted", display: "attempted" },
  progressed: { id: "http://adlnet.gov/expapi/verbs/progressed", display: "progressed" },
  rated: { id: "http://id.tincanapi.com/verb/rated", display: "rated" },
  earned: { id: "http://id.tincanapi.com/verb/earned", display: "earned" },
};

const TYPES = {
  course: "https://w3id.org/xapi/cmi5/activitytype/course",
  module: "http://adlnet.gov/expapi/activities/module",
  lesson: "http://adlnet.gov/expapi/activities/lesson",
  video: "https://w3id.org/xapi/video/activity-type/video",
  quiz: "http://id.tincanapi.com/activitytype/unit-test",
  assessment: "https://w3id.org/xapi/tla/activity-types/assessment",
  assignment: "http://id.tincanapi.com/activitytype/school-assignment",
  "virtual-classroom": "https://w3id.org/xapi/virtual-classroom/activity-types/virtual-classroom",
  certificate: "https://www.opigno.org/en/tincan_registry/activity_type/certificate",
} as const;

type ObjectKind = keyof typeof TYPES;

function iso8601Duration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PT${pad(h)}H${pad(m)}M${pad(sec)}S`;
}

// Course/object descriptions must be plain text — no HTML tags allowed.
function clean(text?: string | null) {
  if (!text) return "";
  return String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// National ID must be 10 digits and start with 1, 2 or 4.
function validNationalId(v?: string | null) {
  return !!v && /^[124]\d{9}$/.test(String(v).trim());
}

// dd/MM/yyyy as required by NELC's date_of_birth extension
function formatDob(d?: string | null) {
  if (!d) return undefined;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function postStatement(statement: unknown) {
  return fetch(LRS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Experience-API-Version": "1.0.3",
      Authorization: "Basic " + btoa(`${LRS_USER}:${LRS_PASS}`),
    },
    body: JSON.stringify(statement),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LRS_ENDPOINT || !LRS_USER || !LRS_PASS) {
      return json({ error: "LRS not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();

    // Admin-only: re-send previously failed statements exactly as stored
    if (body?.resendFailed === true) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Forbidden" }, 403);

      const { data: failed } = await supabase
        .from("xapi_statements")
        .select("id, statement")
        .eq("success", false)
        .order("created_at", { ascending: false })
        .limit(50);

      let resent = 0;
      let ok = 0;
      let lastStatus = 0;
      let lastResponse = "";

      for (const row of failed ?? []) {
        const r = await postStatement(row.statement);
        const t = await r.text();
        lastStatus = r.status;
        lastResponse = t.slice(0, 500);
        resent += 1;
        if (r.ok) ok += 1;
        await supabase
          .from("xapi_statements")
          .update({ success: r.ok, status_code: r.status, response: t.slice(0, 2000) })
          .eq("id", row.id);
      }

      return json({ ok: true, resent, succeeded: ok, lastStatus, lastResponse });
    }

    const {
      verb,
      courseId,
      moduleId,
      lessonId,
      quizId,
      objectKind, // course | module | lesson | video | quiz | virtual-classroom | certificate | assignment | assessment
      objectName,
      objectDescription,
      durationSeconds,
      score, // { raw, min, max, scaled }
      response: userResponse,
      completion,
      success: resultSuccess,
      attemptId,
      certificateUrl,
      targetUserId,
      allowDuplicate,
    } = body ?? {};

    if (!VERBS[verb]) return json({ error: "Unknown verb" }, 400);

    // Only admins may send statements on behalf of another learner
    let actorUserId = user.id;
    if (targetUserId && targetUserId !== user.id) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      actorUserId = targetUserId;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "full_name, full_name_ar, email, phone, national_id, nationality, date_of_birth, preferred_language",
      )
      .eq("id", actorUserId)
      .maybeSingle();

    const email = profile?.email || user.email || `${actorUserId}@josoorcom.com`;
    const nationalId = profile?.national_id?.trim();

    if (!validNationalId(nationalId)) {
      // Learner has no valid national ID yet: skip sending to NELC instead of
      // failing the request, so learning flows are never blocked.
      return json(
        {
          skipped: true,
          reason:
            "MISSING_NATIONAL_ID: يجب أن يكون رقم الهوية 10 أرقام ويبدأ بـ 1 أو 2 أو 4 قبل إرسال العبارات إلى المركز الوطني",
        },
        200,
      );
    }


    // NELC requires actor.name to be the learner's unique identifier (national ID / iqama)
    const actor = {
      mbox: `mailto:${email}`,
      name: String(nationalId),
      objectType: "Agent",
    };

    const language = profile?.preferred_language === "en" ? "en-US" : "ar-SA";

    // Course + instructor info
    let courseName = objectName || "Course";
    let courseDescription = "";
    let courseDurationSeconds = 0;
    let instructor: { name: string; mbox: string } | undefined;

    if (courseId) {
      const { data: course } = await supabase
        .from("courses")
        .select("id, title, title_ar, description, description_ar, duration_hours, instructor_id")
        .eq("id", courseId)
        .maybeSingle();

      if (course) {
        courseName = clean(course.title_ar || course.title) || courseName;
        courseDescription = clean(course.description_ar || course.description);
        courseDurationSeconds = (Number(course.duration_hours) || 0) * 3600;
        if (course.instructor_id) {
          const { data: inst } = await supabase
            .from("profiles")
            .select("full_name, full_name_ar, email")
            .eq("id", course.instructor_id)
            .maybeSingle();
          if (inst?.email) {
            instructor = {
              name: clean(inst.full_name_ar || inst.full_name) || "Instructor",
              mbox: `mailto:${inst.email}`,
            };
          }
        }
      }
    }

    // Object id naming convention:
    // {lms}/course/{courseId}/module/{moduleId}/lesson|video|quiz/{id}
    const courseIri = `${LMS_URL}/course/${courseId ?? "UNKNOWN"}`;
    const moduleIri = moduleId ? `${courseIri}/module/${moduleId}` : courseIri;

    const parentCourse = {
      id: courseIri,
      definition: { name: { [language]: courseName }, type: TYPES.course },
      objectType: "Activity",
    };

    // Resolve the kind of object this statement is about
    let kind: ObjectKind;
    if (objectKind && objectKind in TYPES) kind = objectKind as ObjectKind;
    else if (verb === "earned") kind = "certificate";
    else if (verb === "watched") kind = "video";
    else if (verb === "attended") kind = "virtual-classroom";
    else if (quizId) kind = "quiz";
    else if (lessonId) kind = "lesson";
    else if (moduleId) kind = "module";
    else kind = "course";

    let objectIri: string;
    switch (kind) {
      case "course":
        objectIri = courseIri;
        break;
      case "module":
        objectIri = moduleIri;
        break;
      case "certificate":
        objectIri = `${courseIri}/certificate/${lessonId ?? "CFT001"}`;
        break;
      case "quiz":
      case "assessment":
      case "assignment":
        objectIri = `${moduleIri}/quiz/${quizId ?? lessonId ?? "QZ001"}`;
        break;
      case "video":
        objectIri = `${moduleIri}/video/${lessonId ?? "VD001"}`;
        break;
      case "virtual-classroom":
        objectIri = `${moduleIri}/virtual-classroom/${lessonId ?? "VC001"}`;
        break;
      default:
        objectIri = `${moduleIri}/lesson/${lessonId ?? "LSN001"}`;
    }

    const definition: Record<string, unknown> = {
      name: { [language]: clean(objectName) || courseName },
      type: TYPES[kind],
    };

    // The registration statement must carry the full, clean course description
    const description = clean(objectDescription) || (kind === "course" ? courseDescription : "");
    if (description) definition.description = { [language]: description };

    const object = { id: objectIri, definition, objectType: "Activity" };

    // Duplicate protection — a learner activity must be sent only once
    if (!allowDuplicate) {
      const { data: existing } = await supabase
        .from("xapi_statements")
        .select("id")
        .eq("user_id", actorUserId)
        .eq("verb", verb)
        .eq("success", true)
        .contains("statement", { object: { id: objectIri } })
        .limit(1);
      if (existing && existing.length > 0) {
        return json({ ok: true, duplicate: true, skipped: true, status: 200 });
      }
    }

    // Context
    const extensions: Record<string, unknown> = {
      "https://nelc.gov.sa/extensions/platform": { name: PLATFORM_NAME },
      "https://nelc.gov.sa/extensions/lms_url": LMS_URL,
      "https://nelc.gov.sa/extensions/program_url": courseIri,
    };

    const context: Record<string, unknown> = {
      platform: PLATFORM_KEY,
      language,
      extensions,
    };

    if (instructor) context.instructor = instructor;

    if (verb === "registered") {
      extensions["https://nelc.gov.sa/extensions/duration"] = iso8601Duration(
        courseDurationSeconds || 3600,
      );
      if (profile?.phone) {
        extensions["https://nelc.gov.sa/extensions/learner_mobile_no"] = profile.phone;
      }
      const learnerName = clean(profile?.full_name_ar || profile?.full_name);
      if (learnerName) {
        extensions["https://nelc.gov.sa/extensions/learner_full_name"] = learnerName;
      }
      if (profile?.nationality) {
        extensions["https://nelc.gov.sa/extensions/learner_nationality"] = profile.nationality;
      }
      const dob = formatDob(profile?.date_of_birth as string | null);
      if (dob) extensions["https://nelc.gov.sa/extensions/date_of_birth"] = dob;
    }

    if (typeof attemptId === "number") {
      extensions["http://id.tincanapi.com/extension/attempt-id"] = attemptId;
    }

    if (verb === "earned" && certificateUrl) {
      extensions["http://id.tincanapi.com/extension/jws-certificate-location"] = certificateUrl;
    }

    // Everything below course level carries the course as parent activity
    if (kind !== "course") {
      const parents: Record<string, unknown>[] = [parentCourse];
      if (moduleId && kind !== "module") {
        parents.push({
          id: moduleIri,
          definition: { name: { [language]: `${courseName} - Module` }, type: TYPES.module },
          objectType: "Activity",
        });
      }
      context.contextActivities = { parent: parents };
    }

    // Result
    let result: Record<string, unknown> | undefined = {};
    if (typeof completion === "boolean") result.completion = completion;
    if (typeof resultSuccess === "boolean") result.success = resultSuccess;
    if (typeof durationSeconds === "number") result.duration = iso8601Duration(durationSeconds);
    if (score) result.score = score;
    if (userResponse) result.response = userResponse;
    if (Object.keys(result).length === 0) result = undefined;

    const statement: Record<string, unknown> = {
      actor,
      verb: { id: VERBS[verb].id, display: { "en-US": VERBS[verb].display } },
      object,
      context,
      timestamp: new Date().toISOString(),
    };
    if (result) statement.result = result;

    const lrsRes = await postStatement(statement);
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

    return json({
      ok: lrsRes.ok,
      status: lrsRes.status,
      response: text.slice(0, 1000),
      statement,
    });
  } catch (e) {
    console.error("xapi-track error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
