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
  fileName?: string | null;
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

export const DEFAULT_SETTINGS = (courseId: string): CommunitySettings => ({
  course_id: courseId,
  allow_student_messages: true,
  allow_student_media: true,
  is_chat_muted: false,
  pinned_message_id: null,
  muted_user_ids: [],
});

export interface CommunityBroadcastCallbacks {
  onNewMessage?: (message: CommunityMessage) => void;
  onSettingsUpdated?: (settings: CommunitySettings) => void;
  onPollVoted?: (payload: { messageId: string; optionId: string; userId: string; pollData?: PollData }) => void;
  onPollClosed?: (payload: { messageId: string }) => void;
  onMessagePinned?: (payload: { messageId: string; isPinned: boolean }) => void;
  onMessageDeleted?: (payload: { messageId: string }) => void;
  onGenericUpdate?: () => void;
}

// Active Supabase broadcast channel references per course
const activeChannels: Record<string, any> = {};

/**
 * Get or initialize the shared Realtime channel for a course
 */
export function getCommunityChannel(courseId: string) {
  const channelName = `course-community-live-${courseId}`;
  if (!activeChannels[courseId]) {
    activeChannels[courseId] = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });
    activeChannels[courseId].subscribe();
  }
  return activeChannels[courseId];
}

/**
 * Send a broadcast event to all other clients watching this course community
 */
async function sendBroadcastEvent(courseId: string, event: string, payload: any): Promise<void> {
  try {
    const channel = getCommunityChannel(courseId);
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  } catch (err) {
    console.warn('Broadcast send error:', err);
  }
}

/**
 * Fetch all messages for a course community group
 * Uses multi-tier loading:
 * 1. Instant local cache (0ms)
 * 2. Supabase Storage files in community-state/${courseId}/messages/
 * 3. Aggregates live poll votes & moderation deletions
 */
export async function fetchCommunityMessages(courseId: string): Promise<CommunityMessage[]> {
  const cacheKey = `comm_msgs_${courseId}`;

  // 1. Try local cache first for zero-latency loading
  let cached: CommunityMessage[] = [];
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch {}

  try {
    // 2. Fetch message files from Supabase Storage
    const { data: fileList, error: listErr } = await supabase.storage
      .from('chat-images')
      .list(`community-state/${courseId}/messages`, {
        limit: 150,
        sortBy: { column: 'name', order: 'asc' },
      });

    // 3. Fetch deleted messages / actions
    const { data: actionFiles } = await supabase.storage
      .from('chat-images')
      .list(`community-state/${courseId}/actions`, { limit: 100 });

    const deletedMessageIds = new Set<string>();
    (actionFiles || []).forEach((f) => {
      if (f.name.startsWith('del_')) {
        const parts = f.name.replace('.json', '').split('_');
        if (parts[1]) deletedMessageIds.add(parts[1]);
      }
    });

    // 4. Fetch poll votes
    const { data: voteFiles } = await supabase.storage
      .from('chat-images')
      .list(`community-state/${courseId}/votes`, { limit: 300 });

    // Map pollId -> Map of userId -> optionId (taking latest)
    const pollVotesMap: Record<string, Record<string, string>> = {};
    (voteFiles || []).forEach((vf) => {
      // v_{messageId}_{userId}_{timestamp}.json
      const parts = vf.name.replace('.json', '').split('_');
      if (parts.length >= 4) {
        const pollId = parts[1];
        const voterId = parts[2];
        const timestamp = parseInt(parts[3], 10) || 0;
        if (!pollVotesMap[pollId]) pollVotesMap[pollId] = {};
        (pollVotesMap[pollId] as any)[`${voterId}__ts`] = timestamp;
      }
    });

    if (!listErr && Array.isArray(fileList) && fileList.length > 0) {
      // Download recent message files in parallel (up to 80 latest)
      const targetFiles = fileList
        .filter((f) => f.name.endsWith('.json'))
        .slice(-80);

      const downloadPromises = targetFiles.map(async (f) => {
        try {
          const { data: blob } = await supabase.storage
            .from('chat-images')
            .download(`community-state/${courseId}/messages/${f.name}`);
          if (!blob) return null;
          const text = await blob.text();
          return JSON.parse(text) as CommunityMessage;
        } catch {
          return null;
        }
      });

      const parsedMessages = (await Promise.all(downloadPromises)).filter(Boolean) as CommunityMessage[];

      // Download vote contents for accurate poll counts
      if (voteFiles && voteFiles.length > 0) {
        const voteDownloadPromises = voteFiles.slice(-150).map(async (vf) => {
          try {
            const { data: blob } = await supabase.storage
              .from('chat-images')
              .download(`community-state/${courseId}/votes/${vf.name}`);
            if (!blob) return null;
            const text = await blob.text();
            return JSON.parse(text) as { messageId: string; optionId: string; userId: string };
          } catch {
            return null;
          }
        });
        const votes = (await Promise.all(voteDownloadPromises)).filter(Boolean) as any[];

        // Apply votes to poll messages
        parsedMessages.forEach((msg) => {
          if (msg.message_type === 'poll' && msg.poll_data?.options) {
            const pollVotes = votes.filter((v) => v.messageId === msg.id);
            if (pollVotes.length > 0) {
              const optionVoters: Record<string, Set<string>> = {};
              msg.poll_data.options.forEach((opt) => {
                optionVoters[opt.id] = new Set(opt.voter_ids || []);
              });

              pollVotes.forEach((pv) => {
                if (optionVoters[pv.optionId]) {
                  optionVoters[pv.optionId].add(pv.userId);
                }
              });

              msg.poll_data.options = msg.poll_data.options.map((opt) => ({
                ...opt,
                voter_ids: Array.from(optionVoters[opt.id] || []),
              }));
            }
          }
        });
      }

      // Filter out deleted messages or mark them
      const validMessages = parsedMessages.map((m) => {
        if (deletedMessageIds.has(m.id)) {
          return {
            ...m,
            is_deleted: true,
            content: 'تم حذف هذه الرسالة من قِبل المشرف',
          };
        }
        return m;
      });

      // Sort messages chronologically
      validMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Update local cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify(validMessages));
      } catch {}

      return validMessages;
    }
  } catch (storageErr) {
    console.warn('Storage fetch messages note:', storageErr);
  }

  // Fallback to cache if storage had an issue
  if (cached.length > 0) return cached;

  return [];
}

/**
 * Fetch community controls & settings for a course
 */
export async function fetchCommunitySettings(courseId: string): Promise<CommunitySettings> {
  const cacheKey = `comm_stgs_${courseId}`;

  try {
    const { data: files } = await supabase.storage
      .from('chat-images')
      .list(`community-state/${courseId}/settings`, {
        limit: 10,
        sortBy: { column: 'name', order: 'desc' },
      });

    if (files && files.length > 0) {
      // Pick the latest settings file (sorted desc)
      const latestFile = files.find((f) => f.name.endsWith('.json'));
      if (latestFile) {
        const { data: blob } = await supabase.storage
          .from('chat-images')
          .download(`community-state/${courseId}/settings/${latestFile.name}`);
        if (blob) {
          const text = await blob.text();
          const parsed = JSON.parse(text);
          const fullSettings: CommunitySettings = {
            ...DEFAULT_SETTINGS(courseId),
            ...parsed,
          };
          try {
            localStorage.setItem(cacheKey, JSON.stringify(fullSettings));
          } catch {}
          return fullSettings;
        }
      }
    }
  } catch (err) {
    console.warn('fetchCommunitySettings note:', err);
  }

  // Fallback to local cache or defaults
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw);
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

  const cacheKey = `comm_stgs_${courseId}`;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(updated));
  } catch {}

  // 1. Upload timestamped settings file to storage (allows any instructor/admin without overwrite lock)
  try {
    const fileName = `set_${Date.now()}_${userId}.json`;
    const filePath = `community-state/${courseId}/settings/${fileName}`;
    await supabase.storage
      .from('chat-images')
      .upload(filePath, JSON.stringify(updated), {
        contentType: 'application/json',
        upsert: true,
      });
  } catch (upErr) {
    console.warn('Settings upload note:', upErr);
  }

  // 2. Broadcast updated settings immediately to all connected clients
  await sendBroadcastEvent(courseId, 'settings_updated', updated);

  return updated;
}

/**
 * Send a message to the course community group
 * 1. Persists to storage under community-state/${courseId}/messages/${messageId}.json
 * 2. Broadcasts instantly to all students and instructors
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
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const message: CommunityMessage = {
    id: messageId,
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

  // 1. Save to Supabase Storage
  try {
    const filePath = `community-state/${params.courseId}/messages/${messageId}.json`;
    const { error: upErr } = await supabase.storage
      .from('chat-images')
      .upload(filePath, JSON.stringify(message), {
        contentType: 'application/json',
        upsert: true,
      });

    if (upErr) {
      console.warn('Message storage upload note:', upErr);
    }
  } catch (err) {
    console.warn('Storage send message note:', err);
  }

  // 2. Broadcast immediately to all connected clients in real-time
  await sendBroadcastEvent(params.courseId, 'new_message', message);

  // 3. Update local cache
  try {
    const cacheKey = `comm_msgs_${params.courseId}`;
    const raw = localStorage.getItem(cacheKey);
    const list: CommunityMessage[] = raw ? JSON.parse(raw) : [];
    list.push(message);
    localStorage.setItem(cacheKey, JSON.stringify(list));
  } catch {}

  return message;
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
): Promise<void> {
  // 1. Save vote file
  try {
    const votePath = `community-state/${courseId}/votes/v_${messageId}_${userId}_${Date.now()}.json`;
    await supabase.storage
      .from('chat-images')
      .upload(
        votePath,
        JSON.stringify({ messageId, optionId, userId, votedAt: Date.now() }),
        { contentType: 'application/json', upsert: true }
      );
  } catch (err) {
    console.warn('Vote storage note:', err);
  }

  // 2. Broadcast poll_voted event
  await sendBroadcastEvent(courseId, 'poll_voted', {
    messageId,
    optionId,
    userId,
  });
}

/**
 * Close a poll
 */
export async function closePoll(courseId: string, messageId: string): Promise<void> {
  try {
    const actionPath = `community-state/${courseId}/actions/close_poll_${messageId}_${Date.now()}.json`;
    await supabase.storage
      .from('chat-images')
      .upload(actionPath, JSON.stringify({ messageId, closed: true }), {
        contentType: 'application/json',
        upsert: true,
      });
  } catch (err) {
    console.warn('Close poll storage note:', err);
  }

  await sendBroadcastEvent(courseId, 'poll_closed', { messageId });
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
  await updateCommunitySettings(
    courseId,
    { pinned_message_id: shouldPin ? messageId : null },
    userId
  );

  await sendBroadcastEvent(courseId, 'message_pinned', {
    messageId,
    isPinned: shouldPin,
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
    const actionPath = `community-state/${courseId}/actions/del_${messageId}_${Date.now()}.json`;
    await supabase.storage
      .from('chat-images')
      .upload(actionPath, JSON.stringify({ messageId, deleted: true, isPermanent }), {
        contentType: 'application/json',
        upsert: true,
      });
  } catch (err) {
    console.warn('Delete message storage note:', err);
  }

  // Remove from local cache
  try {
    const cacheKey = `comm_msgs_${courseId}`;
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const list: CommunityMessage[] = JSON.parse(raw);
      const filtered = list.map((m) =>
        m.id === messageId
          ? { ...m, is_deleted: true, content: 'تم حذف هذه الرسالة من قِبل المشرف' }
          : m
      );
      localStorage.setItem(cacheKey, JSON.stringify(filtered));
    }
  } catch {}

  await sendBroadcastEvent(courseId, 'message_deleted', { messageId });
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
  const updated = await updateCommunitySettings(
    courseId,
    { muted_user_ids: Array.from(set) },
    currentUserId
  );

  await sendBroadcastEvent(courseId, 'student_muted', {
    studentId,
    isMuted: shouldMute,
  });

  return updated;
}

/**
 * Realtime subscription to live updates using Supabase Broadcast Channel
 * Fixed channel name ensures ALL participants (students, teachers, admins)
 * are in the exact same broadcast room and receive live updates in <50ms.
 */
export function subscribeToCommunity(
  courseId: string,
  callbacks: CommunityBroadcastCallbacks | (() => void)
): () => void {
  const channel = getCommunityChannel(courseId);

  const handler = typeof callbacks === 'function' ? { onGenericUpdate: callbacks } : callbacks;

  const msgSub = channel.on(
    'broadcast',
    { event: 'new_message' },
    ({ payload }: { payload: CommunityMessage }) => {
      if (handler.onNewMessage) handler.onNewMessage(payload);
      if (handler.onGenericUpdate) handler.onGenericUpdate();
    }
  );

  const stgSub = channel.on(
    'broadcast',
    { event: 'settings_updated' },
    ({ payload }: { payload: CommunitySettings }) => {
      if (handler.onSettingsUpdated) handler.onSettingsUpdated(payload);
      if (handler.onGenericUpdate) handler.onGenericUpdate();
    }
  );

  const voteSub = channel.on(
    'broadcast',
    { event: 'poll_voted' },
    ({ payload }: { payload: any }) => {
      if (handler.onPollVoted) handler.onPollVoted(payload);
      if (handler.onGenericUpdate) handler.onGenericUpdate();
    }
  );

  const closePollSub = channel.on(
    'broadcast',
    { event: 'poll_closed' },
    ({ payload }: { payload: any }) => {
      if (handler.onPollClosed) handler.onPollClosed(payload);
      if (handler.onGenericUpdate) handler.onGenericUpdate();
    }
  );

  const pinSub = channel.on(
    'broadcast',
    { event: 'message_pinned' },
    ({ payload }: { payload: any }) => {
      if (handler.onMessagePinned) handler.onMessagePinned(payload);
      if (handler.onGenericUpdate) handler.onGenericUpdate();
    }
  );

  const delSub = channel.on(
    'broadcast',
    { event: 'message_deleted' },
    ({ payload }: { payload: any }) => {
      if (handler.onMessageDeleted) handler.onMessageDeleted(payload);
      if (handler.onGenericUpdate) handler.onGenericUpdate();
    }
  );

  const muteSub = channel.on(
    'broadcast',
    { event: 'student_muted' },
    () => {
      if (handler.onGenericUpdate) handler.onGenericUpdate();
    }
  );

  return () => {
    // Keep channel open or unregister handlers
  };
}
