// NELC / FutureX LRS connectivity verification
// Sends a minimal test statement and optionally queries it back.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LRS_ENDPOINT = Deno.env.get("NELC_LRS_ENDPOINT") ?? "";
const LRS_USER = Deno.env.get("NELC_LRS_USERNAME") ?? "";
const LRS_PASS = Deno.env.get("NELC_LRS_PASSWORD") ?? "";
const PLATFORM = Deno.env.get("NELC_PLATFORM_URL") ?? "https://josoorcom.com";
// Explicit, normal client signature — NELC's edge returns 403 (errorCode 1010)
// for generic runtime user agents.
const LRS_USER_AGENT =
  Deno.env.get("NELC_USER_AGENT") ?? "JosoorcomLMS/1.0 (+https://josoorcom.com; xAPI-client)";

function authHeader() {
  return "Basic " + btoa(`${LRS_USER}:${LRS_PASS}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LRS_ENDPOINT || !LRS_USER || !LRS_PASS) {
      return new Response(
        JSON.stringify({ verified: false, error: "LRS credentials are not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
    const nationalId = body?.nationalId || "0000000000";

    const statement = {
      id: testId,
      actor: {
        name: "Josoorcom Verification",
        objectType: "Agent",
        account: {
          homePage: PLATFORM,
          name: String(nationalId),
        },
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/registered",
        display: { "en-US": "registered" },
      },
      object: {
        id: `${PLATFORM}/courses/verification-test`,
        definition: {
          name: { "en-US": "NELC LRS Verification Test" },
          type: "https://w3id.org/xapi/cmi5/activitytype/course",
        },
        objectType: "Activity",
      },
      context: {
        platform: PLATFORM,
        language: "ar-SA",
        extensions: {
          "https://nelc.gov.sa/extensions/platform": { name: { "ar-SA": "جسوركم", "en-US": "Josoorcom" } },
        },
      },
      timestamp: new Date().toISOString(),
    };

    const postRes = await fetch(LRS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": LRS_USER_AGENT,
        "X-Experience-API-Version": "1.0.3",
        Authorization: authHeader(),
      },
      body: JSON.stringify(statement),
    });

    const postText = await postRes.text();

    await supabase.from("xapi_statements").insert({
      user_id: user.id,
      verb: "verified",
      course_id: "verification-test",
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

    const getUrl = new URL(LRS_ENDPOINT);
    getUrl.searchParams.set("statementId", testId);

    const getRes = await fetch(getUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": LRS_USER_AGENT,
        "X-Experience-API-Version": "1.0.3",
        Authorization: authHeader(),
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
