import { supabase } from "@/integrations/supabase/client";

/**
 * Triggers AI transcript generation for a lesson in the background.
 * Called automatically when a lesson is saved with a video URL.
 * Silently fails - does not block the save flow.
 */
export async function triggerTranscriptGeneration(lessonId: string) {
  try {
    // Check if transcript already exists
    const { data: existing } = await supabase
      .from("lesson_transcripts")
      .select("id, status")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existing?.status === "completed") return;

    // Fire and forget - don't await
    supabase.functions.invoke("generate-transcript", {
      body: { lessonId },
    }).then(({ error }) => {
      if (error) console.error("Auto transcript generation failed:", error);
      else console.log("Transcript generated for lesson:", lessonId);
    });
  } catch (err) {
    console.error("Failed to trigger transcript generation:", err);
  }
}
