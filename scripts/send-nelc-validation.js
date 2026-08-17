/**
 * Standalone NELC Validation Scenario Runner (23 xAPI Statements)
 * Run directly using: node scripts/send-nelc-validation.js
 */

const LRS_ENDPOINT = process.env.NELC_LRS_ENDPOINT || "https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements";
const LRS_USER = process.env.NELC_LRS_USERNAME || "josoorcom_com";
const LRS_PASS = process.env.NELC_LRS_PASSWORD || "sf93!1Y6Aq#3";
const PLATFORM = (process.env.NELC_PLATFORM_KEY || "https://josoorcom.com").replace(/\/+$/, "");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 JosoorcomLMS/1.0 (+https://josoorcom.com; xAPI-client)";

const NATIONAL_ID = process.argv[2] || "1051212338";
const LEARNER_EMAIL = process.argv[3] || `${NATIONAL_ID}@josoorcom.com`;
const COURSE_ID = "CR001";
const COURSE_TITLE = "دورة تطوير تطبيقات الويب والذكاء الاصطناعي";
const COURSE_DESC = "دورة تدريبية شاملة ومعتمدة في تطوير المنصات وتطبيقات الويب الحديثة";

const TYPES = {
  course: "https://w3id.org/xapi/cmi5/activitytype/course",
  module: "http://adlnet.gov/expapi/activities/module",
  lesson: "http://adlnet.gov/expapi/activities/lesson",
  video: "https://w3id.org/xapi/video/activity-type/video",
  quiz: "http://id.tincanapi.com/activitytype/unit-test",
  "virtual-classroom": "https://w3id.org/xapi/virtual-classroom/activity-types/virtual-classroom",
  certificate: "https://www.opigno.org/en/tincan_registry/activity_type/certificate",
};

const VERBS = {
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

const parentCourse = {
  id: `${PLATFORM}/course/${COURSE_ID}`,
  definition: {
    name: { "ar-SA": COURSE_TITLE, "en-US": COURSE_TITLE },
    type: TYPES.course,
  },
  objectType: "Activity",
};

const instructor = {
  name: "إبراهيم خالد",
  mbox: "mailto:instructor@josoorcom.com",
};

const actor = {
  mbox: `mailto:${LEARNER_EMAIL}`,
  name: String(NATIONAL_ID),
  objectType: "Agent",
};

function buildStatements() {
  const list = [];
  const courseIri = `${PLATFORM}/course/${COURSE_ID}`;

  // 1. registered
  list.push({
    name: "1. التسجيل في الدورة (registered)",
    statement: {
      actor,
      verb: { id: VERBS.registered.id, display: { "en-US": VERBS.registered.display } },
      object: {
        id: courseIri,
        definition: {
          name: { "ar-SA": COURSE_TITLE, "en-US": COURSE_TITLE },
          description: { "ar-SA": COURSE_DESC, "en-US": COURSE_DESC },
          type: TYPES.course,
        },
        objectType: "Activity",
      },
      context: {
        instructor,
        platform: PLATFORM,
        language: "ar-SA",
        extensions: {
          "https://nelc.gov.sa/extensions/duration": "PT30H00M00S",
          "https://nelc.gov.sa/extensions/lms_url": PLATFORM,
          "https://nelc.gov.sa/extensions/program_url": courseIri,
          "https://nelc.gov.sa/extensions/learner_mobile_no": "+966550000000",
          "https://nelc.gov.sa/extensions/learner_full_name": "عبدالرحمن محمد",
          "https://nelc.gov.sa/extensions/learner_nationality": "Saudi Arabia",
          "https://nelc.gov.sa/extensions/date_of_birth": "18/06/1998",
          "https://nelc.gov.sa/extensions/platform": {
            name: { "ar-SA": "جسوركم", "en-US": "Josoorcom" },
          },
        },
      },
      timestamp: new Date().toISOString(),
    },
  });

  // 2. initialized
  list.push({
    name: "2. بدء الدورة (initialized)",
    statement: {
      actor,
      verb: { id: VERBS.initialized.id, display: { "en-US": VERBS.initialized.display } },
      object: {
        id: courseIri,
        definition: {
          name: { "ar-SA": COURSE_TITLE, "en-US": COURSE_TITLE },
          type: TYPES.course,
        },
        objectType: "Activity",
      },
      context: {
        instructor,
        platform: PLATFORM,
        language: "ar-SA",
        extensions: {
          "https://nelc.gov.sa/extensions/platform": {
            name: { "ar-SA": "جسوركم", "en-US": "Josoorcom" },
          },
        },
      },
      timestamp: new Date().toISOString(),
    },
  });

  // Units 1 to 3 (6 steps each)
  const units = [
    { num: 1, modId: "MDL001", name: "الوحدة الأولى", progress: 0.30, score: 95 },
    { num: 2, modId: "MDL002", name: "الوحدة الثانية", progress: 0.60, score: 90 },
    { num: 3, modId: "MDL003", name: "الوحدة الثالثة", progress: 0.90, score: 98 },
  ];

  for (const u of units) {
    const modIri = `${courseIri}/module/${u.modId}`;

    // watched
    list.push({
      name: `مشاهدة فيديو ${u.name} (watched)`,
      statement: {
        actor,
        verb: { id: VERBS.watched.id, display: { "en-US": VERBS.watched.display } },
        object: {
          id: `${modIri}/video/VD00${u.num}`,
          definition: {
            name: { "ar-SA": `${COURSE_TITLE} - فيديو ${u.name}`, "en-US": `${COURSE_TITLE} - Video Unit ${u.num}` },
            type: TYPES.video,
          },
          objectType: "Activity",
        },
        context: {
          platform: PLATFORM,
          language: "ar-SA",
          contextActivities: { parent: [parentCourse] },
        },
        result: { completion: true, duration: "PT00H10M22S" },
        timestamp: new Date().toISOString(),
      },
    });

    // completed lesson
    list.push({
      name: `إكمال درس ${u.name} (completed lesson)`,
      statement: {
        actor,
        verb: { id: VERBS.completed.id, display: { "en-US": VERBS.completed.display } },
        object: {
          id: `${modIri}/lesson/LSN00${u.num}`,
          definition: {
            name: { "ar-SA": `${COURSE_TITLE} - درس ${u.name}`, "en-US": `${COURSE_TITLE} - Lesson Unit ${u.num}` },
            type: TYPES.lesson,
          },
          objectType: "Activity",
        },
        context: {
          platform: PLATFORM,
          language: "ar-SA",
          contextActivities: { parent: [parentCourse] },
        },
        result: { duration: "PT00H05M00S" },
        timestamp: new Date().toISOString(),
      },
    });

    // attended virtual classroom
    list.push({
      name: `حضور جلسة افتراضية ${u.name} (attended)`,
      statement: {
        actor,
        verb: { id: VERBS.attended.id, display: { "en-US": VERBS.attended.display } },
        object: {
          id: `${modIri}/virtual-classroom/VC00${u.num}`,
          definition: {
            name: { "ar-SA": `${COURSE_TITLE} - جلسة تفاعلية ${u.name}`, "en-US": `${COURSE_TITLE} - Live Session Unit ${u.num}` },
            type: TYPES["virtual-classroom"],
          },
          objectType: "Activity",
        },
        context: {
          platform: PLATFORM,
          language: "ar-SA",
          contextActivities: { parent: [parentCourse] },
        },
        result: { completion: true, duration: "PT01H30M00S" },
        timestamp: new Date().toISOString(),
      },
    });

    // attempted quiz
    list.push({
      name: `أداء اختبار ${u.name} (attempted quiz)`,
      statement: {
        actor,
        verb: { id: VERBS.attempted.id, display: { "en-US": VERBS.attempted.display } },
        object: {
          id: `${modIri}/quiz/QZ00${u.num}`,
          definition: {
            name: { "ar-SA": `${COURSE_TITLE} - اختبار ${u.name}`, "en-US": `${COURSE_TITLE} - Quiz Unit ${u.num}` },
            type: TYPES.quiz,
          },
          objectType: "Activity",
        },
        context: {
          platform: PLATFORM,
          language: "ar-SA",
          extensions: { "http://id.tincanapi.com/extension/attempt-id": 1 },
          contextActivities: { parent: [parentCourse] },
        },
        result: {
          score: { raw: u.score, min: 0, max: 100, scaled: Number((u.score / 100).toFixed(2)) },
          success: true,
          completion: false,
        },
        timestamp: new Date().toISOString(),
      },
    });

    // completed module
    list.push({
      name: `إكمال ${u.name} (completed module)`,
      statement: {
        actor,
        verb: { id: VERBS.completed.id, display: { "en-US": VERBS.completed.display } },
        object: {
          id: modIri,
          definition: {
            name: { "ar-SA": `${COURSE_TITLE} - ${u.name}`, "en-US": `${COURSE_TITLE} - Unit ${u.num}` },
            type: TYPES.module,
          },
          objectType: "Activity",
        },
        context: {
          platform: PLATFORM,
          language: "ar-SA",
          contextActivities: { parent: [parentCourse] },
        },
        timestamp: new Date().toISOString(),
      },
    });

    // progressed
    list.push({
      name: `تحديث التقدم إلى ${u.progress * 100}% (progressed)`,
      statement: {
        actor,
        verb: { id: VERBS.progressed.id, display: { "en-US": VERBS.progressed.display } },
        object: {
          id: courseIri,
          definition: {
            name: { "ar-SA": COURSE_TITLE, "en-US": COURSE_TITLE },
            type: TYPES.course,
          },
          objectType: "Activity",
        },
        context: { platform: PLATFORM, language: "ar-SA" },
        result: { score: { scaled: u.progress }, completion: true },
        timestamp: new Date().toISOString(),
      },
    });
  }

  // 21. completed course
  list.push({
    name: "21. إكمال الدورة كاملة (completed course)",
    statement: {
      actor,
      verb: { id: VERBS.completed.id, display: { "en-US": VERBS.completed.display } },
      object: {
        id: courseIri,
        definition: {
          name: { "ar-SA": COURSE_TITLE, "en-US": COURSE_TITLE },
          type: TYPES.course,
        },
        objectType: "Activity",
      },
      context: { platform: PLATFORM, language: "ar-SA" },
      timestamp: new Date().toISOString(),
    },
  });

  // 22. rated
  list.push({
    name: "22. تقييم الدورة (rated)",
    statement: {
      actor,
      verb: { id: VERBS.rated.id, display: { "en-US": VERBS.rated.display } },
      object: {
        id: courseIri,
        definition: {
          name: { "ar-SA": COURSE_TITLE, "en-US": COURSE_TITLE },
          type: TYPES.course,
        },
        objectType: "Activity",
      },
      context: { platform: PLATFORM, language: "ar-SA" },
      result: {
        score: { raw: 4, min: 0, max: 5, scaled: 0.8 },
        response: "دورة ممتازة ومحتوى شامل وواضح جداً",
      },
      timestamp: new Date().toISOString(),
    },
  });

  // 23. earned certificate
  list.push({
    name: "23. إصدار الشهادة (earned certificate)",
    statement: {
      actor,
      verb: { id: VERBS.earned.id, display: { "en-US": VERBS.earned.display } },
      object: {
        id: `${courseIri}/certificate/CFT001`,
        definition: {
          name: { "ar-SA": `شهادة إتمام ${COURSE_TITLE}`, "en-US": `Certificate of completion ${COURSE_TITLE}` },
          type: TYPES.certificate,
        },
        objectType: "Activity",
      },
      context: {
        platform: PLATFORM,
        language: "ar-SA",
        extensions: {
          "http://id.tincanapi.com/extension/jws-certificate-location": `${PLATFORM}/certificate/${COURSE_ID}`,
          "https://nelc.gov.sa/extensions/platform": {
            name: { "ar-SA": "جسوركم", "en-US": "Josoorcom" },
          },
        },
        contextActivities: { parent: [parentCourse] },
      },
      timestamp: new Date().toISOString(),
    },
  });

  return list;
}

async function postStatement(item) {
  const res = await fetch(LRS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      "X-Experience-API-Version": "1.0.3",
      Authorization: "Basic " + Buffer.from(`${LRS_USER}:${LRS_PASS}`).toString("base64"),
    },
    body: JSON.stringify(item.statement),
  });

  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

async function main() {
  console.log("==================================================");
  console.log("NELC / FutureX Validation Scenario Runner (23 Steps)");
  console.log("==================================================");
  console.log(`Endpoint:    ${LRS_ENDPOINT}`);
  console.log(`Platform:    ${PLATFORM}`);
  console.log(`Username:    ${LRS_USER}`);
  console.log(`National ID: ${NATIONAL_ID}`);
  console.log(`Learner:     ${LEARNER_EMAIL}`);
  console.log("--------------------------------------------------\n");

  const steps = buildStatements();
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    process.stdout.write(`[${i + 1}/23] ${step.name} ... `);
    try {
      const res = await postStatement(step);
      if (res.ok) {
        ok++;
        console.log(`✅ HTTP ${res.status} | Response: ${res.text.slice(0, 80)}`);
      } else {
        fail++;
        console.log(`❌ HTTP ${res.status} | Error: ${res.text.slice(0, 120)}`);
      }
    } catch (e) {
      fail++;
      console.log(`❌ NETWORK ERROR: ${e.message}`);
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log("\n==================================================");
  console.log(`Summary: ${ok} succeeded, ${fail} failed.`);
  if (fail === 0) {
    console.log("🎉 All 23 statements delivered successfully!");
    console.log("👉 Now open the FutureX portal and click 'Validate'.");
  } else {
    console.log("⚠️ Some statements failed. Check network or IP whitelisting.");
  }
  console.log("==================================================");
}

main();
