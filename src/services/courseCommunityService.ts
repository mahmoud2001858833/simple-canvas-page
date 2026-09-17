import { supabase } from '@/integrations/supabase/client';

export type UserCommunityRole = 'student' | 'instructor' | 'admin';
export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'poll' | 'announcement';

export interface PollOption {
  id: string;
  text: string;
  voter_ids: string[];
}

export interface PollData {
  question: string;
  options: PollOption[];
  is_multiple?: boolean;
  is_closed?: boolean;
}

export interface ReplyToSnapshot {
  id: string;
  sender_name: string;
  content: string;
  message_type?: MessageType;
}

export interface CommunityMessage {
  id: string;
  course_id: string;
  sender_id: string;
  sender_role: UserCommunityRole;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  message_type: MessageType;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  poll_data?: PollData | null;
  reply_to?: ReplyToSnapshot | null;
  reactions?: Record<string, string[]> | null;
  is_pinned?: boolean;
  is_deleted?: boolean;
  created_at: string;
}

export interface CommunitySettings {
  course_id: string;
  allow_student_messages: boolean;
  allow_student_media: boolean;
  is_chat_muted: boolean;
  pinned_message_id?: string | null;
  muted_user_ids: string[];
  updated_at?: string;
  updated_by?: string | null;
}

const DEFAULT_SETTINGS = (courseId: string): CommunitySettings => ({
  course_id: courseId,
  allow_student_messages: true,
  allow_student_media: true,
  is_chat_muted: false,
  pinned_message_id: null,
  muted_user_ids: [],
});

let cachedThreadId: Record<string, string> = {};

/**
 * Get or create community discussion thread using client-side authenticated user
 */
async function getOrCreateThread(courseId: string): Promise<string | null> {
  if (cachedThreadId[courseId]) return cachedThreadId[courseId];

  try {
    // 1. Check if discussion already exists for this course
    const { data: discussions, error: findErr } = await supabase
      .from('course_discussions')
      .select('id, title, content')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!findErr && discussions && discussions.length > 0) {
      cachedThreadId[courseId] = discussions[0].id;
      return discussions[0].id;
    }

    // 2. If no discussion exists, create one with the logged-in user
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return null;

    const { data: created, error: insertErr } = await supabase
      .from('course_discussions')
      .insert({
        course_id: courseId,
        user_id: authData.user.id,
        title: '__COURSE_COMMUNITY_MAIN__',
        content: JSON.stringify(DEFAULT_SETTINGS(courseId)),
      })
      .select('id')
      .maybeSingle();

    if (!insertErr && created?.id) {
      cachedThreadId[courseId] = created.id;
      return created.id;
    }

    // If duplicate or race condition, query again
    const { data: retry } = await supabase
      .from('course_discussions')
      .select('id')
      .eq('course_id', courseId)
      .limit(1);

    if (retry && retry.length > 0) {
      cachedThreadId[courseId] = retry[0].id;
      return retry[0].id;
    }
  } catch (err) {
    console.warn('getOrCreateThread note:', err);
  }

  return null;
}

/**
 * Helper to get auth headers for API calls
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

/**
 * Fetch all messages for a course community group
 */
export async function fetchCommunityMessages(courseId: string): Promise<CommunityMessage[]> {
  // 1. Direct Supabase Query (Fast & Safe without invalid schema join)
  try {
    const threadId = await getOrCreateThread(courseId);
    if (threadId) {
      const { data: replies, error } = await supabase
        .from('discussion_replies')
        .select('*')
        .eq('discussion_id', threadId)
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(replies)) {
        return replies.map((row: any) => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(row.content || '{}');
          } catch {
            parsed = { text: row.content };
          }

          return {
            id: row.id,
            course_id: courseId,
            sender_id: row.user_id,
            sender_role: parsed.sender_role || 'student',
            sender_name:
              parsed.sender_name ||
              (parsed.sender_role === 'admin'
                ? 'إدارة المنصة'
                : parsed.sender_role === 'instructor'
                ? 'معلم الدورة'
                : 'طالب'),
            sender_avatar: parsed.sender_avatar || null,
            content: parsed.text || (typeof parsed === 'string' ? parsed : ''),
            message_type: parsed.message_type || 'text',
            file_url: parsed.file_url || null,
            file_name: parsed.file_name || null,
            file_size: parsed.file_size || null,
            poll_data: parsed.poll_data || null,
            reply_to: parsed.reply_to || null,
            reactions: parsed.reactions || {},
            is_pinned: !!parsed.is_pinned,
            is_deleted: !!parsed.is_deleted,
            created_at: row.created_at,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Direct fetch messages error:', err);
  }

  // 2. Server API Fallback
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/course-community?action=get_messages&courseId=${encodeURIComponent(courseId)}`, {
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.messages)) {
        return data.messages;
      }
    }
  } catch (apiErr) {
    console.warn('API fetch fallback error:', apiErr);
  }

  return [];
}

/**
 * Fetch community controls & settings for a course
 */
export async function fetchCommunitySettings(courseId: string): Promise<CommunitySettings> {
  try {
    const threadId = await getOrCreateThread(courseId);
    if (threadId) {
      const { data: disc } = await supabase
        .from('course_discussions')
        .select('content')
        .eq('id', threadId)
        .maybeSingle();

      if (disc?.content) {
        try {
          const parsed = JSON.parse(disc.content);
          return { ...DEFAULT_SETTINGS(courseId), ...parsed };
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Direct settings error:', err);
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/course-community?action=get_settings&courseId=${encodeURIComponent(courseId)}`, {
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.settings) {
        return data.settings;
      }
    }
  } catch {}

  return DEFAULT_SETTINGS(courseId);
}

/**
 * Update community settings (teacher or admin only)
 */
export async function updateCommunitySettings(
  courseId: string,
  settings: Partial<CommunitySettings>,
  userId: string
): Promise<CommunitySettings> {
  const current = await fetchCommunitySettings(courseId);
  const updated: CommunitySettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  try {
    const threadId = await getOrCreateThread(courseId);
    if (threadId) {
      await supabase
        .from('course_discussions')
        .update({ content: JSON.stringify(updated) })
        .eq('id', threadId);
      return updated;
    }
  } catch (err) {
    console.warn('Direct settings update error:', err);
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/course-community', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'update_settings',
        courseId,
        settings: updated,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.settings) return data.settings;
    }
  } catch {}

  return updated;
}

/**
 * Send a message to the course community group
 */
export async function sendCommunityMessage(params: {
  courseId: string;
  senderId: string;
  senderRole: UserCommunityRole;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  messageType?: MessageType;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  pollData?: PollData | null;
  replyTo?: ReplyToSnapshot | null;
}): Promise<CommunityMessage> {
  const messageType = params.messageType || 'text';
  const payload = {
    text: params.content,
    sender_role: params.senderRole,
    sender_name: params.senderName,
    sender_avatar: params.senderAvatar,
    message_type: messageType,
    file_url: params.fileUrl,
    file_name: params.fileName,
    file_size: params.fileSize,
    poll_data: params.pollData,
    reply_to: params.replyTo,
    is_pinned: false,
    is_deleted: false,
  };

  // 1. Direct Supabase insert (authenticated client)
  try {
    const threadId = await getOrCreateThread(params.courseId);
    if (threadId) {
      const { data: replyRow, error: replyErr } = await supabase
        .from('discussion_replies')
        .insert({
          discussion_id: threadId,
          user_id: params.senderId,
          content: JSON.stringify(payload),
        })
        .select('*')
        .single();

      if (!replyErr && replyRow) {
        return {
          id: replyRow.id,
          course_id: params.courseId,
          sender_id: params.senderId,
          sender_role: params.senderRole,
          sender_name: params.senderName,
          sender_avatar: params.senderAvatar || null,
          content: params.content,
          message_type: messageType,
          file_url: params.fileUrl || null,
          file_name: params.fileName || null,
          file_size: params.fileSize || null,
          poll_data: params.pollData || null,
          reply_to: params.replyTo || null,
          reactions: {},
          is_pinned: false,
          is_deleted: false,
          created_at: replyRow.created_at,
        };
      }
    }
  } catch (directErr) {
    console.warn('Direct send message note:', directErr);
  }

  // 2. Server API fallback
  const headers = await getAuthHeaders();
  const res = await fetch('/api/course-community', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'send_message',
      courseId: params.courseId,
      senderId: params.senderId,
      senderRole: params.senderRole,
      senderName: params.senderName,
      senderAvatar: params.senderAvatar || null,
      content: params.content,
      messageType,
      fileUrl: params.fileUrl || null,
      fileName: params.fileName || null,
      fileSize: params.fileSize || null,
      pollData: params.pollData || null,
      replyTo: params.replyTo || null,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    if (data?.success && data.message) {
      return data.message;
    }
  }

  throw new Error('فشل إرسال الرسالة، يرجى المحاولة ثانية');
}

/**
 * Upload an attachment or image to chat-images storage bucket
 */
export async function uploadCommunityAttachment(
  file: File,
  courseId: string,
  userId: string
): Promise<{ fileUrl: string; fileName: string; fileSize: number; fileType: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const cleanName = file.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .slice(0, 70);
  const path = `community/${courseId}/${userId}/${Date.now()}-${cleanName}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('chat-images')
    .getPublicUrl(path);

  return {
    fileUrl: publicUrl,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || ext,
  };
}

/**
 * Vote on an interactive poll
 */
export async function voteOnPoll(
  courseId: string,
  messageId: string,
  optionId: string,
  userId: string
): Promise<PollData> {
  const { data: existing } = await supabase
    .from('discussion_replies')
    .select('content')
    .eq('id', messageId)
    .single();

  if (existing?.content) {
    const parsed = JSON.parse(existing.content);
    const poll = parsed.poll_data;
    if (poll && !poll.is_closed) {
      const isMultiple = !!poll.is_multiple;
      poll.options = poll.options.map((opt: any) => {
        const voterSet = new Set(opt.voter_ids || []);
        if (opt.id === optionId) {
          if (voterSet.has(userId)) {
            voterSet.delete(userId);
          } else {
            voterSet.add(userId);
          }
        } else if (!isMultiple) {
          voterSet.delete(userId);
        }
        return { ...opt, voter_ids: Array.from(voterSet) };
      });

      parsed.poll_data = poll;

      await supabase
        .from('discussion_replies')
        .update({ content: JSON.stringify(parsed) })
        .eq('id', messageId);

      return poll;
    }
  }

  // API Fallback
  const headers = await getAuthHeaders();
  const res = await fetch('/api/course-community', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'vote_poll',
      courseId,
      messageId,
      optionId,
      userId,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    if (data?.success && data.poll) return data.poll;
  }

  throw new Error('فشل تسجيل التصويت');
}

/**
 * Close a poll
 */
export async function closePoll(courseId: string, messageId: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('discussion_replies')
      .select('content')
      .eq('id', messageId)
      .single();

    if (existing?.content) {
      const parsed = JSON.parse(existing.content);
      if (parsed.poll_data) {
        parsed.poll_data.is_closed = true;
        await supabase
          .from('discussion_replies')
          .update({ content: JSON.stringify(parsed) })
          .eq('id', messageId);
        return;
      }
    }
  } catch {}

  const headers = await getAuthHeaders();
  await fetch('/api/course-community', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'close_poll', courseId, messageId }),
  });
}

/**
 * Pin or unpin a message
 */
export async function togglePinMessage(
  courseId: string,
  messageId: string,
  shouldPin: boolean,
  userId: string
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('discussion_replies')
      .select('content')
      .eq('id', messageId)
      .single();

    if (existing?.content) {
      const parsed = JSON.parse(existing.content);
      parsed.is_pinned = shouldPin;
      await supabase
        .from('discussion_replies')
        .update({ content: JSON.stringify(parsed) })
        .eq('id', messageId);
    }

    await updateCommunitySettings(
      courseId,
      { pinned_message_id: shouldPin ? messageId : null },
      userId
    );
    return;
  } catch {}

  const headers = await getAuthHeaders();
  await fetch('/api/course-community', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'pin_message', courseId, messageId, isPinned: shouldPin }),
  });
}

/**
 * Delete a message
 */
export async function deleteCommunityMessage(
  courseId: string,
  messageId: string,
  isPermanent = false
): Promise<void> {
  try {
    if (isPermanent) {
      await supabase.from('discussion_replies').delete().eq('id', messageId);
    } else {
      const { data: existing } = await supabase
        .from('discussion_replies')
        .select('content')
        .eq('id', messageId)
        .single();

      if (existing?.content) {
        const parsed = JSON.parse(existing.content);
        parsed.is_deleted = true;
        parsed.text = 'تم حذف هذه الرسالة من قِبل المشرف';
        await supabase
          .from('discussion_replies')
          .update({ content: JSON.stringify(parsed) })
          .eq('id', messageId);
      }
    }
    return;
  } catch {}

  const headers = await getAuthHeaders();
  await fetch('/api/course-community', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'delete_message', courseId, messageId }),
  });
}

/**
 * Mute or unmute a student in the course community
 */
export async function toggleMuteStudent(
  courseId: string,
  studentId: string,
  shouldMute: boolean,
  currentUserId: string
): Promise<CommunitySettings> {
  const current = await fetchCommunitySettings(courseId);
  const set = new Set(current.muted_user_ids || []);
  if (shouldMute) {
    set.add(studentId);
  } else {
    set.delete(studentId);
  }
  return await updateCommunitySettings(
    courseId,
    { muted_user_ids: Array.from(set) },
    currentUserId
  );
}

/**
 * Realtime subscription to live updates
 */
export function subscribeToCommunity(
  courseId: string,
  onUpdate: () => void
): () => void {
  const channelName = `community-live-${courseId}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'discussion_replies',
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'course_discussions',
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
