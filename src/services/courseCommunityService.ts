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

const DEFAULT_SETTINGS: (courseId: string) => CommunitySettings = (courseId) => ({
  course_id: courseId,
  allow_student_messages: true,
  allow_student_media: true,
  is_chat_muted: false,
  pinned_message_id: null,
  muted_user_ids: [],
});

let useFallbackStorage = false;

/**
 * Get or create community discussion thread if running in fallback mode
 */
async function getOrCreateFallbackDiscussion(courseId: string): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('course_discussions')
      .select('id')
      .eq('course_id', courseId)
      .eq('title', '__COURSE_COMMUNITY_MAIN__')
      .maybeSingle();

    if (existing?.id) return existing.id;

    // Get current user
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return null;

    const { data: created, error } = await supabase
      .from('course_discussions')
      .insert({
        course_id: courseId,
        user_id: authData.user.id,
        title: '__COURSE_COMMUNITY_MAIN__',
        content: JSON.stringify(DEFAULT_SETTINGS(courseId)),
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Fallback discussion creation note:', error);
      return null;
    }
    return created?.id || null;
  } catch (err) {
    console.warn('Fallback discussion error:', err);
    return null;
  }
}

/**
 * Fetch all messages for a course community group
 */
export async function fetchCommunityMessages(courseId: string): Promise<CommunityMessage[]> {
  if (!useFallbackStorage) {
    try {
      const { data, error } = await (supabase as any)
        .from('course_community_messages')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        return data as CommunityMessage[];
      }
      if (error && (error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist'))) {
        useFallbackStorage = true;
      }
    } catch {
      useFallbackStorage = true;
    }
  }

  // Fallback mode using discussion_replies
  try {
    const discId = await getOrCreateFallbackDiscussion(courseId);
    if (!discId) return [];

    const { data, error } = await supabase
      .from('discussion_replies')
      .select('*, profiles:user_id(full_name, full_name_ar, avatar_url)')
      .eq('discussion_id', discId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((row: any) => {
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
        sender_name: parsed.sender_name || row.profiles?.full_name_ar || row.profiles?.full_name || 'طالب',
        sender_avatar: row.profiles?.avatar_url || null,
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
  } catch (fallbackErr) {
    console.warn('Error fetching fallback messages:', fallbackErr);
    return [];
  }
}

/**
 * Fetch community controls & settings for a course
 */
export async function fetchCommunitySettings(courseId: string): Promise<CommunitySettings> {
  if (!useFallbackStorage) {
    try {
      const { data, error } = await (supabase as any)
        .from('course_community_settings')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();

      if (!error && data) {
        return {
          course_id: courseId,
          allow_student_messages: data.allow_student_messages ?? true,
          allow_student_media: data.allow_student_media ?? true,
          is_chat_muted: data.is_chat_muted ?? false,
          pinned_message_id: data.pinned_message_id || null,
          muted_user_ids: Array.isArray(data.muted_user_ids) ? data.muted_user_ids : [],
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        };
      }
    } catch {
      // Fallback
    }
  }

  // Fallback: load settings from main discussion content
  try {
    const { data: disc } = await supabase
      .from('course_discussions')
      .select('content')
      .eq('course_id', courseId)
      .eq('title', '__COURSE_COMMUNITY_MAIN__')
      .maybeSingle();

    if (disc?.content) {
      const parsed = JSON.parse(disc.content);
      return { ...DEFAULT_SETTINGS(courseId), ...parsed };
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

  if (!useFallbackStorage) {
    try {
      const { error } = await (supabase as any)
        .from('course_community_settings')
        .upsert(updated, { onConflict: 'course_id' });

      if (!error) return updated;
    } catch {
      useFallbackStorage = true;
    }
  }

  // Fallback update
  try {
    const discId = await getOrCreateFallbackDiscussion(courseId);
    if (discId) {
      await supabase
        .from('course_discussions')
        .update({ content: JSON.stringify(updated) })
        .eq('id', discId);
    }
  } catch (err) {
    console.warn('Fallback settings update note:', err);
  }

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
  const newMsg: Partial<CommunityMessage> = {
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
    created_at: new Date().toISOString(),
  };

  if (!useFallbackStorage) {
    try {
      const { data, error } = await (supabase as any)
        .from('course_community_messages')
        .insert(newMsg)
        .select('*')
        .single();

      if (!error && data) {
        return data as CommunityMessage;
      }
      if (error && (error.code === '42P01' || error.message?.includes('schema cache'))) {
        useFallbackStorage = true;
      } else if (error) {
        throw error;
      }
    } catch (err: any) {
      if (err?.code === '42P01' || err?.message?.includes('schema cache')) {
        useFallbackStorage = true;
      } else {
        throw err;
      }
    }
  }

  // Fallback insert into discussion_replies
  const discId = await getOrCreateFallbackDiscussion(params.courseId);
  if (!discId) throw new Error('Could not access course community thread');

  const payload = {
    text: params.content,
    sender_role: params.senderRole,
    sender_name: params.senderName,
    message_type: messageType,
    file_url: params.fileUrl,
    file_name: params.fileName,
    file_size: params.fileSize,
    poll_data: params.pollData,
    reply_to: params.replyTo,
    is_pinned: false,
    is_deleted: false,
  };

  const { data: replyRow, error: replyErr } = await supabase
    .from('discussion_replies')
    .insert({
      discussion_id: discId,
      user_id: params.senderId,
      content: JSON.stringify(payload),
    })
    .select('*')
    .single();

  if (replyErr) throw replyErr;

  return {
    ...(newMsg as CommunityMessage),
    id: replyRow.id,
    created_at: replyRow.created_at,
  };
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
 * Vote or change vote on an interactive poll
 */
export async function voteOnPoll(
  courseId: string,
  messageId: string,
  optionId: string,
  userId: string
): Promise<PollData> {
  const messages = await fetchCommunityMessages(courseId);
  const msg = messages.find((m) => m.id === messageId);
  if (!msg || !msg.poll_data) throw new Error('Poll not found');
  if (msg.poll_data.is_closed) throw new Error('Poll is closed');

  const poll = { ...msg.poll_data };
  const isMultiple = !!poll.is_multiple;

  poll.options = poll.options.map((opt) => {
    const voterSet = new Set(opt.voter_ids || []);
    if (opt.id === optionId) {
      if (voterSet.has(userId)) {
        voterSet.delete(userId); // toggle off
      } else {
        voterSet.add(userId);
      }
    } else if (!isMultiple) {
      voterSet.delete(userId); // single-choice clears other options
    }
    return { ...opt, voter_ids: Array.from(voterSet) };
  });

  if (!useFallbackStorage) {
    try {
      const { error } = await (supabase as any)
        .from('course_community_messages')
        .update({ poll_data: poll })
        .eq('id', messageId);

      if (!error) return poll;
    } catch {}
  }

  // Fallback update
  try {
    const { data: existing } = await supabase
      .from('discussion_replies')
      .select('content')
      .eq('id', messageId)
      .single();

    if (existing?.content) {
      const parsed = JSON.parse(existing.content);
      parsed.poll_data = poll;
      await supabase
        .from('discussion_replies')
        .update({ content: JSON.stringify(parsed) })
        .eq('id', messageId);
    }
  } catch (err) {
    console.warn('Fallback poll vote update note:', err);
  }

  return poll;
}

/**
 * Close a poll (no more votes allowed)
 */
export async function closePoll(courseId: string, messageId: string): Promise<void> {
  const messages = await fetchCommunityMessages(courseId);
  const msg = messages.find((m) => m.id === messageId);
  if (!msg || !msg.poll_data) return;

  const updatedPoll: PollData = { ...msg.poll_data, is_closed: true };

  if (!useFallbackStorage) {
    try {
      await (supabase as any)
        .from('course_community_messages')
        .update({ poll_data: updatedPoll })
        .eq('id', messageId);
      return;
    } catch {}
  }

  try {
    const { data: existing } = await supabase
      .from('discussion_replies')
      .select('content')
      .eq('id', messageId)
      .single();

    if (existing?.content) {
      const parsed = JSON.parse(existing.content);
      parsed.poll_data = updatedPoll;
      await supabase
        .from('discussion_replies')
        .update({ content: JSON.stringify(parsed) })
        .eq('id', messageId);
    }
  } catch {}
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
  if (!useFallbackStorage) {
    try {
      await (supabase as any)
        .from('course_community_messages')
        .update({ is_pinned: shouldPin })
        .eq('id', messageId);

      await updateCommunitySettings(
        courseId,
        { pinned_message_id: shouldPin ? messageId : null },
        userId
      );
      return;
    } catch {}
  }

  // Fallback update
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
  } catch {}
}

/**
 * Delete a message (mark as deleted or remove)
 */
export async function deleteCommunityMessage(
  courseId: string,
  messageId: string,
  isPermanent = false
): Promise<void> {
  if (!useFallbackStorage) {
    try {
      if (isPermanent) {
        await (supabase as any)
          .from('course_community_messages')
          .delete()
          .eq('id', messageId);
      } else {
        await (supabase as any)
          .from('course_community_messages')
          .update({ is_deleted: true, content: 'تم حذف هذه الرسالة من قِبل المشرف' })
          .eq('id', messageId);
      }
      return;
    } catch {}
  }

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
  } catch {}
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
  const channelName = `community-${courseId}-${Date.now()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'course_community_messages',
        filter: `course_id=eq.${courseId}`,
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'course_community_settings',
        filter: `course_id=eq.${courseId}`,
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'discussion_replies',
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
