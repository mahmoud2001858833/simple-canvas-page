// NELC / FutureX LRS connectivity verification
// Sends a minimal test statement and optionally queries it back.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LRS_ENDPOINT = Deno.env.get("NELC_LRS_ENDPOINT") || "https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements";
const LRS_USER = Deno.env.get("NELC_LRS_USERNAME") || "josoorcom_com";
const LRS_PASS = Deno.env.get("NELC_LRS_PASSWORD") || "sf93!1Y6Aq#3";
const PLATFORM = (Deno.env.get("NELC_PLATFORM_KEY") || Deno.env.get("NELC_PLATFORM_URL") || "https://josoorcom.com").replace(/\/+$/, "");

const LRS_USER_AGENT =
  Deno.env.get("NELC_USER_AGENT") ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 JosoorcomLMS/1.0 (+https://josoorcom.com; xAPI-client)";

function authHeader() {
  return "Basic " + btoa(`${LRS_USER}:${LRS_PASS}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeaderValue = req.headers.get("Authorization") ?? "";
    const token = authHeaderValue.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) {
      return new Response(
        JSON.stringify({ verified: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ verified: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const testId = body?.testId || `verify-${Date.now()}`;
    const nationalId = body?.nationalId || "1051212338";

    const effectiveEndpoint = body?.lrsEndpoint || LRS_ENDPOINT;
    const effectiveUser = body?.lrsUsername || LRS_USER;
    const effectivePass = body?.lrsPassword || LRS_PASS;
    const effectivePlatform = (body?.platformKey || PLATFORM).replace(/\/+$/, "");

    if (!effectiveEndpoint || !effectiveUser || !effectivePass) {
      return new Response(
        JSON.stringify({ verified: false, error: "LRS credentials are not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const statement = {
      id: testId,
      actor: {
        mbox: `mailto:${user.email || "verification@josoorcom.com"}`,
        name: String(nationalId),
        objectType: "Agent",
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/registered",
        display: { "en-US": "registered" },
      },
      object: {
        id: `${effectivePlatform}/course/CR001`,
        definition: {
          name: { "ar-SA": "اختبار التحقق من الاتصال", "en-US": "NELC LRS Verification Test" },
          description: { "ar-SA": "دورة تجريبية لاختبار تكامل المنصة مع المركز الوطني", "en-US": "Verification test course description" },
          type: "https://w3id.org/xapi/cmi5/activitytype/course",
        },
        objectType: "Activity",
      },
      context: {
        instructor: {
          name: "إبراهيم خالد",
          mbox: "mailto:instructor@josoorcom.com",
        },
        platform: effectivePlatform,
        language: "ar-SA",
        extensions: {
          "https://nelc.gov.sa/extensions/duration": "PT01H00M00S",
          "https://nelc.gov.sa/extensions/lms_url": effectivePlatform,
          "https://nelc.gov.sa/extensions/program_url": `${effectivePlatform}/course/CR001`,
          "https://nelc.gov.sa/extensions/learner_mobile_no": "+966550000000",
          "https://nelc.gov.sa/extensions/learner_full_name": "متعلم تجريبي",
          "https://nelc.gov.sa/extensions/learner_nationality": "Saudi Arabia",
          "https://nelc.gov.sa/extensions/date_of_birth": "01/01/2000",
          "https://nelc.gov.sa/extensions/platform": {
            name: { "ar-SA": "جسوركم", "en-US": "Josoorcom" },
          },
        },
      },
      timestamp: new Date().toISOString(),
    };

    const postRes = await fetch(effectiveEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": LRS_USER_AGENT,
        "X-Experience-API-Version": "1.0.3",
        Authorization: "Basic " + btoa(`${effectiveUser}:${effectivePass}`),
      },
      body: JSON.stringify(statement),
    });

    const postText = await postRes.text();

    await supabase.from("xapi_statements").insert({
      user_id: user.id,
      verb: "verified",
      course_id: "CR001",
      statement,
      status_code: postRes.status,
      response: postText.slice(0, 2000),
      success: postRes.ok,
    });

    if (!postRes.ok) {
      return new Response(
        JSON.stringify({
          verified: false,
          error: "LRS rejected the test statement",
          status: postRes.status,
          response: postText.slice(0, 1000),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Give NELC a moment to index the statement, then query it back.
    await new Promise((r) => setTimeout(r, 1500));

    const getUrl = new URL(effectiveEndpoint);
    getUrl.searchParams.set("statementId", testId);

    const getRes = await fetch(getUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": LRS_USER_AGENT,
        "X-Experience-API-Version": "1.0.3",
        Authorization: "Basic " + btoa(`${effectiveUser}:${effectivePass}`),
      },
    });


    const getText = await getRes.text();
    let retrievedStatement = null;
    try {
      retrievedStatement = getText ? JSON.parse(getText) : null;
    } catch {
      retrievedStatement = null;
    }

    return new Response(
      JSON.stringify({
        verified: postRes.ok && getRes.ok && retrievedStatement?.id === testId,
        postStatus: postRes.status,
        getStatus: getRes.status,
        statementId: testId,
        posted: postRes.ok,
        retrieved: getRes.ok && retrievedStatement?.id === testId,
        response: getText.slice(0, 1000),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("lrs-verify error", e);
    return new Response(
      JSON.stringify({ verified: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

