// NELC / FutureX xAPI 1.0.3 integration
// Builds and sends learning statements to the National eLearning Center LRS
// following the official "NELC — xAPI Profiles Guidelines".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LRS_ENDPOINT = Deno.env.get("NELC_LRS_ENDPOINT") || "https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements";
const LRS_USER = Deno.env.get("NELC_LRS_USERNAME") || "josoorcom_com";
const LRS_PASS = Deno.env.get("NELC_LRS_PASSWORD") || "u8V%ly718L7!";

// LMS base URL used to build every object id
const LMS_URL = (Deno.env.get("NELC_PLATFORM_URL") || "https://josoorcom.com").replace(/\/+$/, "");
// The platform key registered with NELC. Must match registered platform URL character-by-character.
const PLATFORM_KEY = Deno.env.get("NELC_PLATFORM_KEY") || "https://josoorcom.com";

// Standard browser User-Agent to avoid Cloudflare WAF errorCode 1010 block
export const LRS_USER_AGENT =
  Deno.env.get("NELC_USER_AGENT") ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 JosoorcomLMS/1.0 (+https://josoorcom.com; xAPI-client)";

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
  if (!d) return "01/01/2000";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "01/01/2000";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function postStatement(
  statement: unknown,
  endpoint = LRS_ENDPOINT,
  username = LRS_USER,
  password = LRS_PASS,
) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": LRS_USER_AGENT,
      "X-Experience-API-Version": "1.0.3",
      Authorization: "Basic " + btoa(`${username}:${password}`),
    },
    body: JSON.stringify(statement),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const effectiveEndpoint = body?.lrsEndpoint || LRS_ENDPOINT;
    const effectiveUser = body?.lrsUsername || LRS_USER;
    const effectivePass = body?.lrsPassword || LRS_PASS;
    const effectivePlatformKey = body?.platformKey || PLATFORM_KEY;

    if (!effectiveEndpoint || !effectiveUser || !effectivePass) {
      return json({ error: "LRS credentials not configured" }, 500);
    }

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
        const r = await postStatement(row.statement, effectiveEndpoint, effectiveUser, effectivePass);
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

    const language = "ar-SA";

    // Course + instructor info
    let courseName = clean(objectName) || "مادة تدريبية";
    let courseDescription = "وصف تفصيلي للدورة التدريبية معتمد في المنصة";
    let courseDurationSeconds = 3600 * 30;
    let instructor: { name: string; mbox: string } = {
      name: "إبراهيم خالد",
      mbox: "mailto:instructor@josoorcom.com",
    };

    if (courseId) {
      const { data: course } = await supabase
        .from("courses")
        .select("id, title, title_ar, description, description_ar, duration_hours, instructor_id")
        .eq("id", courseId)
        .maybeSingle();

      if (course) {
        courseName = clean(course.title_ar || course.title) || courseName;
        courseDescription = clean(course.description_ar || course.description) || courseDescription;
        if (course.duration_hours) {
          courseDurationSeconds = (Number(course.duration_hours) || 0) * 3600;
        }
        if (course.instructor_id) {
          const { data: inst } = await supabase
            .from("profiles")
            .select("full_name, full_name_ar, email")
            .eq("id", course.instructor_id)
            .maybeSingle();
          if (inst) {
            const instName = clean(inst.full_name_ar || inst.full_name);
            const instEmail = inst.email || "instructor@josoorcom.com";
            if (instName) {
              instructor = {
                name: instName,
                mbox: `mailto:${instEmail}`,
              };
            }
          }
        }
      }
    }

    // Object id naming convention:
    // {lms}/course/{courseId}/module/{moduleId}/lesson|video|quiz/{id}
    const resolvedCourseCode = courseId ? `CR${courseId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}` : "CR001";
    const courseIri = `${LMS_URL}/course/${resolvedCourseCode}`;
    const effectiveModuleId = moduleId || "MDL001";
    const moduleIri = `${courseIri}/module/${effectiveModuleId}`;

    const parentCourse = {
      id: courseIri,
      definition: {
        name: { "ar-SA": courseName, "en-US": courseName },
        type: TYPES.course,
      },
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
        objectIri = `${moduleIri}/virtual-classroom/${lessonId ?? "VD001"}`;
        break;
      default:
        objectIri = `${moduleIri}/lesson/${lessonId ?? "LSN001"}`;
    }

    const resolvedObjName = clean(objectName) || courseName;
    const definition: Record<string, unknown> = {
      name: { "ar-SA": resolvedObjName, "en-US": resolvedObjName },
      type: TYPES[kind],
    };

    // The registration statement must carry the full, clean course description (NELC rule: other course statements MUST NOT have description)
    if (verb === "registered") {
      const description = clean(objectDescription) || courseDescription;
      if (description) {
        definition.description = { "ar-SA": description, "en-US": description };
      }
    }


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

    // Strict context formatting per NELC verb profiles
    const context: Record<string, unknown> = {
      platform: effectivePlatformKey,
      language,
    };


    if (verb === "registered") {
      context.instructor = instructor;
      const learnerFullName = clean(profile?.full_name_ar || profile?.full_name) || "متعلم جسوركم";
      const learnerMobile = profile?.phone || "+966550000000";
      const learnerNationality = profile?.nationality || "Saudi Arabia";
      const dob = formatDob(profile?.date_of_birth as string | null);

      context.extensions = {
        "https://nelc.gov.sa/extensions/duration": iso8601Duration(courseDurationSeconds || 3600 * 30),
        "https://nelc.gov.sa/extensions/lms_url": LMS_URL,
        "https://nelc.gov.sa/extensions/program_url": courseIri,
        "https://nelc.gov.sa/extensions/learner_mobile_no": learnerMobile,
        "https://nelc.gov.sa/extensions/learner_full_name": learnerFullName,
        "https://nelc.gov.sa/extensions/learner_nationality": learnerNationality,
        "https://nelc.gov.sa/extensions/date_of_birth": dob,
        "https://nelc.gov.sa/extensions/platform": {
          name: PLATFORM_NAME,
        },
      };
    } else if (verb === "initialized") {
      context.instructor = instructor;
      context.extensions = {
        "https://nelc.gov.sa/extensions/platform": {
          name: PLATFORM_NAME,
        },
      };
    } else if (verb === "attempted") {
      context.extensions = {
        "http://id.tincanapi.com/extension/attempt-id": typeof attemptId === "number" ? attemptId : 1,
      };
      context.contextActivities = { parent: [parentCourse] };
    } else if (verb === "earned") {
      const certLoc = certificateUrl || `${LMS_URL}/certificate/${courseId ?? "CR001"}`;
      context.extensions = {
        "http://id.tincanapi.com/extension/jws-certificate-location": certLoc,
        "https://nelc.gov.sa/extensions/platform": {
          name: PLATFORM_NAME,
        },
      };
      context.contextActivities = { parent: [parentCourse] };
    } else if (kind !== "course") {
      context.contextActivities = { parent: [parentCourse] };
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

