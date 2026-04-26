import { supabase } from "@/integrations/supabase/client";

export async function triggerTranscriptGeneration(lessonId: string) {
  try {
    const { data: existing } = await supabase
      .from("lesson_transcripts")
      .select("id, status")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existing?.status === "completed") return;

    supabase.functions.invoke("generate-transcript", {
      body: { lessonId },
    }).then(({ error }) => {
      if (error) console.error("Auto transcript generation failed:", error);
    });
  } catch (err) {
    console.error("Failed to trigger transcript generation:", err);
  }
}
