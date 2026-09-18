import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nrioqyolqusiexgpxfxz.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yaW9xeW9scXVzaWV4Z3B4Znh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NTUyOTAsImV4cCI6MjA4NDIzMTI5MH0.Uz6aoBl2kjTKENXw8eTrSdOM4W93RVuWTDWr1fCLpAo';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_SETTINGS = {
  allow_student_messages: true,
  allow_student_media: true,
  is_chat_muted: false,
  pinned_message_id: null,
  muted_user_ids: [],
};

// Fallback: Read messages from storage
async function readMessagesFromStorage(courseId: string) {
  try {
    const { data: fileList } = await supabaseAdmin.storage
      .from('chat-images')
      .list(`community-state/${courseId}/messages`, { limit: 100 });

    if (!fileList || fileList.length === 0) return [];

    const jsonFiles = fileList.filter((f) => f.name.endsWith('.json')).slice(-60);
    const downloads = jsonFiles.map(async (f) => {
      try {
        const { data: blob } = await supabaseAdmin.storage
          .from('chat-images')
          .download(`community-state/${courseId}/messages/${f.name}`);
        if (!blob) return null;
        const txt = await blob.text();
        return JSON.parse(txt);
      } catch {
        return null;
      }
    });

    const msgs = (await Promise.all(downloads)).filter(Boolean);
    msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return msgs;
  } catch {
    return [];
  }
}

// Fallback: Read settings from storage
async function readSettingsFromStorage(courseId: string) {
  try {
    const { data: files } = await supabaseAdmin.storage
      .from('chat-images')
      .list(`community-state/${courseId}/settings`, { limit: 10 });

    if (files && files.length > 0) {
      const sorted = files.filter((f) => f.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name));
      const latest = sorted[0];
      if (latest) {
        const { data: blob } = await supabaseAdmin.storage
          .from('chat-images')
          .download(`community-state/${courseId}/settings/${latest.name}`);
        if (blob) {
          const txt = await blob.text();
          return { ...DEFAULT_SETTINGS, course_id: courseId, ...JSON.parse(txt) };
        }
      }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS, course_id: courseId };
}

export default async function handler(req: any, res: any) {
  // CORS headers
  const origin = req.headers?.origin || req.headers?.Origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, apikey, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const action = req.query?.action || body.action;
    const courseId = req.query?.courseId || body.courseId;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // 1. GET MESSAGES
    if (action === 'get_messages' || (req.method === 'GET' && !action)) {
      const msgs = await readMessagesFromStorage(courseId);
      return res.status(200).json({ success: true, messages: msgs });
    }

    // 2. GET SETTINGS
    if (action === 'get_settings') {
      const settings = await readSettingsFromStorage(courseId);
      return res.status(200).json({ success: true, settings });
    }

    // 3. SEND MESSAGE
    if (action === 'send_message') {
      const {
        senderId,
        senderRole = 'student',
        senderName,
        senderAvatar,
        content,
        messageType = 'text',
        fileUrl,
        fileName,
        fileSize,
        pollData,
        replyTo,
      } = body;

      if (!senderId || (!content && !fileUrl && !pollData)) {
        return res.status(400).json({ error: 'senderId and message content are required' });
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newMsg = {
        id: messageId,
        course_id: courseId,
        sender_id: senderId,
        sender_role: senderRole,
        sender_name: senderName || 'مستخدم',
        sender_avatar: senderAvatar || null,
        content: content || '',
        message_type: messageType,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        poll_data: pollData || null,
        reply_to: replyTo || null,
        reactions: {},
        is_pinned: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
      };

      try {
        await supabaseAdmin.storage
          .from('chat-images')
          .upload(
            `community-state/${courseId}/messages/${messageId}.json`,
            JSON.stringify(newMsg),
            { contentType: 'application/json', upsert: false }
          );
      } catch (e) {
        console.warn('Storage save in API note:', e);
      }

      // Broadcast immediately to live channel
      try {
        const liveChannel = supabaseAdmin.channel(`course-community-live-${courseId}`);
        await liveChannel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: newMsg,
        });
      } catch {}

      return res.status(200).json({ success: true, message: newMsg });
    }

    // 4. UPDATE SETTINGS
    if (action === 'update_settings') {
      const { settings, userId } = body;
      const current = await readSettingsFromStorage(courseId);
      const updated = { ...current, ...settings, updated_at: new Date().toISOString() };

      try {
        const fileName = `set_${Date.now()}_${userId || 'admin'}.json`;
        await supabaseAdmin.storage
          .from('chat-images')
          .upload(
            `community-state/${courseId}/settings/${fileName}`,
            JSON.stringify(updated),
            { contentType: 'application/json', upsert: false }
          );
      } catch {}

      return res.status(200).json({ success: true, settings: updated });
    }

    // 5. VOTE POLL
    if (action === 'vote_poll') {
      const { messageId, optionId, userId } = body;
      try {
        const voteFile = `v_${messageId}_${userId}_${Date.now()}.json`;
        await supabaseAdmin.storage
          .from('chat-images')
          .upload(
            `community-state/${courseId}/votes/${voteFile}`,
            JSON.stringify({ messageId, optionId, userId, votedAt: Date.now() }),
            { contentType: 'application/json', upsert: false }
          );
      } catch {}

      return res.status(200).json({ success: true });
    }

    // 6. CLOSE POLL
    if (action === 'close_poll') {
      const { messageId } = body;
      try {
        await supabaseAdmin.storage
          .from('chat-images')
          .upload(
            `community-state/${courseId}/actions/close_poll_${messageId}_${Date.now()}.json`,
            JSON.stringify({ messageId, closed: true }),
            { contentType: 'application/json', upsert: false }
          );
      } catch {}

      return res.status(200).json({ success: true });
    }

    // 7. PIN MESSAGE
    if (action === 'pin_message') {
      const { messageId, isPinned, userId } = body;
      const current = await readSettingsFromStorage(courseId);
      const updated = { ...current, pinned_message_id: isPinned ? messageId : null };
      try {
        const fileName = `set_${Date.now()}_${userId || 'admin'}.json`;
        await supabaseAdmin.storage
          .from('chat-images')
          .upload(
            `community-state/${courseId}/settings/${fileName}`,
            JSON.stringify(updated),
            { contentType: 'application/json', upsert: false }
          );
      } catch {}

      return res.status(200).json({ success: true });
    }

    // 8. DELETE MESSAGE
    if (action === 'delete_message') {
      const { messageId } = body;
      try {
        await supabaseAdmin.storage
          .from('chat-images')
          .upload(
            `community-state/${courseId}/actions/del_${messageId}_${Date.now()}.json`,
            JSON.stringify({ messageId, deleted: true }),
            { contentType: 'application/json', upsert: false }
          );
      } catch {}

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error('Course community API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
