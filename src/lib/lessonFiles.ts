import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'lesson-files';

/**
 * The `lesson-files` bucket is private. Stored file_url values may still be legacy
 * public URLs, so we extract the object path and mint a short-lived signed URL,
 * which is only granted to users allowed by the storage RLS policies.
 */
export function extractLessonFilePath(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const marker = `/${BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = fileUrl.slice(idx + marker.length).split('?')[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function getLessonFileUrl(fileUrl: string, expiresIn = 3600): Promise<string | null> {
  const path = extractLessonFilePath(fileUrl);
  if (!path) return fileUrl || null; // external URL, leave as-is

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
