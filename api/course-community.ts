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

// Helper to ensure thread exists for the course
async function ensureCourseDiscussionThread(courseId: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from('course_discussions')
    .select('id')
    .eq('course_id', courseId)
    .eq('title', '__COURSE_COMMUNITY_MAIN__')
    .maybeSingle();

  if (existing?.id) return existing.id;

  // Find course instructor or fallback to a system user
  const { data: courseRow } = await supabaseAdmin
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle();

  let creatorId = courseRow?.instructor_id;
  if (!creatorId) {
    const { data: adminUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();
    creatorId = adminUser?.id;
  }

  const { data: created, error } = await supabaseAdmin
    .from('course_discussions')
    .insert({
      course_id: courseId,
      user_id: creatorId || '00000000-0000-0000-0000-000000000000',
      title: '__COURSE_COMMUNITY_MAIN__',
      content: JSON.stringify({ ...DEFAULT_SETTINGS, course_id: courseId }),
    })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Could not create course discussion thread');
  }

  return created.id;
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
      const threadId = await ensureCourseDiscussionThread(courseId);

      const { data: replies, error: repErr } = await supabaseAdmin
        .from('discussion_replies')
        .select('*')
        .eq('discussion_id', threadId)
        .order('created_at', { ascending: true });

      if (repErr) throw repErr;

      // Extract user profiles
      const userIds = Array.from(new Set((replies || []).map((r: any) => r.user_id).filter(Boolean)));
      const profilesMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, full_name_ar, avatar_url')
          .in('id', userIds);

        (profs || []).forEach((p: any) => {
          profilesMap[p.id] = p;
        });
      }

      const messages = (replies || []).map((row: any) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(row.content || '{}');
        } catch {
          parsed = { text: row.content };
        }

        const profile = profilesMap[row.user_id];
        return {
          id: row.id,
          course_id: courseId,
          sender_id: row.user_id,
          sender_role: parsed.sender_role || 'student',
          sender_name:
            parsed.sender_name ||
            profile?.full_name_ar ||
            profile?.full_name ||
            (parsed.sender_role === 'admin' ? 'إدارة المنصة' : parsed.sender_role === 'instructor' ? 'معلم الدورة' : 'طالب'),
          sender_avatar: parsed.sender_avatar || profile?.avatar_url || null,
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

      return res.status(200).json({ success: true, messages });
    }

    // 2. GET SETTINGS
    if (action === 'get_settings') {
      const threadId = await ensureCourseDiscussionThread(courseId);
      const { data: disc } = await supabaseAdmin
        .from('course_discussions')
        .select('content')
        .eq('id', threadId)
        .single();

      let settings = { ...DEFAULT_SETTINGS, course_id: courseId };
      if (disc?.content) {
        try {
          settings = { ...settings, ...JSON.parse(disc.content) };
        } catch {}
      }
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

      const threadId = await ensureCourseDiscussionThread(courseId);

      const payload = {
        text: content,
        sender_role: senderRole,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        message_type: messageType,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        poll_data: pollData || null,
        reply_to: replyTo || null,
        is_pinned: false,
        is_deleted: false,
      };

      const { data: replyRow, error: replyErr } = await supabaseAdmin
        .from('discussion_replies')
        .insert({
          discussion_id: threadId,
          user_id: senderId,
          content: JSON.stringify(payload),
        })
        .select('*')
        .single();

      if (replyErr) throw replyErr;

      const newMsg = {
        id: replyRow.id,
        course_id: courseId,
        sender_id: senderId,
        sender_role: senderRole,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        content: content,
        message_type: messageType,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        poll_data: pollData || null,
        reply_to: replyTo || null,
        reactions: {},
        is_pinned: false,
        is_deleted: false,
        created_at: replyRow.created_at,
      };

      return res.status(200).json({ success: true, message: newMsg });
    }

    // 4. UPDATE SETTINGS
    if (action === 'update_settings') {
      const { settings } = body;
      const threadId = await ensureCourseDiscussionThread(courseId);

      const updated = { ...DEFAULT_SETTINGS, course_id: courseId, ...settings };

      await supabaseAdmin
        .from('course_discussions')
        .update({ content: JSON.stringify(updated) })
        .eq('id', threadId);

      return res.status(200).json({ success: true, settings: updated });
    }

    // 5. VOTE POLL
    if (action === 'vote_poll') {
      const { messageId, optionId, userId } = body;
      const { data: existing, error: eErr } = await supabaseAdmin
        .from('discussion_replies')
        .select('content')
        .eq('id', messageId)
        .single();

      if (eErr || !existing) throw new Error('Message not found');

      const parsed = JSON.parse(existing.content);
      const poll = parsed.poll_data;
      if (!poll) throw new Error('Poll not found');
      if (poll.is_closed) throw new Error('Poll is closed');

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

      await supabaseAdmin
        .from('discussion_replies')
        .update({ content: JSON.stringify(parsed) })
        .eq('id', messageId);

      return res.status(200).json({ success: true, poll });
    }

    // 6. CLOSE POLL
    if (action === 'close_poll') {
      const { messageId } = body;
      const { data: existing } = await supabaseAdmin
        .from('discussion_replies')
        .select('content')
        .eq('id', messageId)
        .single();

      if (existing) {
        const parsed = JSON.parse(existing.content);
        if (parsed.poll_data) {
          parsed.poll_data.is_closed = true;
          await supabaseAdmin
            .from('discussion_replies')
            .update({ content: JSON.stringify(parsed) })
            .eq('id', messageId);
        }
      }

      return res.status(200).json({ success: true });
    }

    // 7. PIN MESSAGE
    if (action === 'pin_message') {
      const { messageId, isPinned } = body;
      const { data: existing } = await supabaseAdmin
        .from('discussion_replies')
        .select('content')
        .eq('id', messageId)
        .single();

      if (existing) {
        const parsed = JSON.parse(existing.content);
        parsed.is_pinned = isPinned;
        await supabaseAdmin
          .from('discussion_replies')
          .update({ content: JSON.stringify(parsed) })
          .eq('id', messageId);
      }

      return res.status(200).json({ success: true });
    }

    // 8. DELETE MESSAGE
    if (action === 'delete_message') {
      const { messageId } = body;
      const { data: existing } = await supabaseAdmin
        .from('discussion_replies')
        .select('content')
        .eq('id', messageId)
        .single();

      if (existing) {
        const parsed = JSON.parse(existing.content);
        parsed.is_deleted = true;
        parsed.text = 'تم حذف هذه الرسالة من قِبل المشرف';
        await supabaseAdmin
          .from('discussion_replies')
          .update({ content: JSON.stringify(parsed) })
          .eq('id', messageId);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error('Course community API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
