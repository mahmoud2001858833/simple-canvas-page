import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CommunityMessage,
  CommunitySettings,
  MessageType,
  PollData,
  ReplyToSnapshot,
  UserCommunityRole,
  fetchCommunityMessages,
  fetchCommunitySettings,
  sendCommunityMessage,
  uploadCommunityAttachment,
  voteOnPoll,
  closePoll,
  togglePinMessage,
  deleteCommunityMessage,
  toggleMuteStudent,
  subscribeToCommunity,
} from '@/services/courseCommunityService';
import { CourseCommunitySettingsDialog } from './CourseCommunitySettingsDialog';
import { CreatePollDialog } from './CreatePollDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  BarChart2,
  Settings,
  Pin,
  Trash2,
  Reply,
  Copy,
  MoreVertical,
  VolumeX,
  Check,
  CheckCheck,
  Search,
  X,
  Download,
  AlertCircle,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Lock,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

interface CourseCommunityChatProps {
  courseId: string;
  courseTitle: string;
  instructorId?: string;
  instructorName?: string;
  thumbnailUrl?: string | null;
  className?: string;
}

export const CourseCommunityChat: React.FC<CourseCommunityChatProps> = ({
  courseId,
  courseTitle,
  instructorId,
  instructorName,
  thumbnailUrl,
  className = '',
}) => {
  const { user, profile, role: globalRole } = useAuth();
  const { dir } = useLanguage();
  const isRTL = dir === 'rtl';

  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [settings, setSettings] = useState<CommunitySettings>({
    course_id: courseId,
    allow_student_messages: true,
    allow_student_media: true,
    is_chat_muted: false,
    pinned_message_id: null,
    muted_user_ids: [],
  });

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Dialogs
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyToSnapshot | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Role determinations
  const isSuperAdmin = globalRole === 'admin';
  const isInstructor = (user?.id && instructorId && user.id === instructorId) || globalRole === 'instructor';
  const hasManagerAccess = isSuperAdmin || isInstructor;

  const currentRole: UserCommunityRole = isSuperAdmin
    ? 'admin'
    : isInstructor
    ? 'instructor'
    : 'student';

  const isCurrentStudentMuted =
    !hasManagerAccess && !!user?.id && (settings.muted_user_ids || []).includes(user.id);

  const canStudentSendMessages =
    hasManagerAccess || (!settings.is_chat_muted && settings.allow_student_messages && !isCurrentStudentMuted);

  const canStudentSendMedia =
    hasManagerAccess || (canStudentSendMessages && settings.allow_student_media);

  // Load data & subscribe
  const loadData = async () => {
    try {
      const [msgs, stgs] = await Promise.all([
        fetchCommunityMessages(courseId),
        fetchCommunitySettings(courseId),
      ]);
      setMessages(msgs);
      setSettings(stgs);
    } catch (e) {
      console.warn('Load community data note:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToCommunity(courseId, () => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [courseId]);

  // Auto scroll to bottom
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [messages.length, loading]);

  // Send text message
  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || !user || !canStudentSendMessages) return;

    const tempId = `temp_${Date.now()}`;
    const senderName = profile?.full_name_ar || profile?.full_name || (currentRole === 'admin' ? 'إدارة جسوركم' : currentRole === 'instructor' ? 'معلم الدورة' : 'طالب');
    const optimisticMsg: CommunityMessage = {
      id: tempId,
      course_id: courseId,
      sender_id: user.id,
      sender_role: currentRole,
      sender_name: senderName,
      sender_avatar: profile?.avatar_url || null,
      content: text,
      message_type: 'text',
      reply_to: replyingTo,
      reactions: {},
      is_pinned: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
    };

    // Instant optimistic render
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputMessage('');
    const prevReply = replyingTo;
    setReplyingTo(null);
    scrollToBottom();

    setSending(true);
    try {
      const confirmed = await sendCommunityMessage({
        courseId,
        senderId: user.id,
        senderRole: currentRole,
        senderName,
        senderAvatar: profile?.avatar_url || null,
        content: text,
        messageType: 'text',
        replyTo: prevReply,
      });

      setMessages((prev) => prev.map((m) => (m.id === tempId ? confirmed : m)));
    } catch (err: any) {
      toast.error(err.message || 'فشل إرسال الرسالة');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputMessage(text);
    } finally {
      setSending(false);
    }
  };

  // Upload attachment (image or file)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImage = true) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!canStudentSendMedia) {
      toast.error('رفع الصور والملفات مغلق حالياً من قِبل المعلم');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('أقصى حجم للملف هو 25 ميجابايت');
      return;
    }

    setUploading(true);
    const toastId = toast.loading('جارٍ رفع المرفق...');
    try {
      const uploaded = await uploadCommunityAttachment(file, courseId, user.id);

      await sendCommunityMessage({
        courseId,
        senderId: user.id,
        senderRole: currentRole,
        senderName: profile?.full_name_ar || profile?.full_name || 'طالب',
        senderAvatar: profile?.avatar_url || null,
        content: isImage ? '📷 صورة' : `📎 ملف: ${uploaded.fileName}`,
        messageType: isImage ? 'image' : 'file',
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        replyTo: replyingTo,
      });

      toast.success('تم إرسال المرفق', { id: toastId });
      setReplyingTo(null);
      await loadData();
      scrollToBottom();
    } catch (err: any) {
      toast.error(err.message || 'فشل رفع الملف', { id: toastId });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Create poll
  const handleCreatePoll = async (question: string, options: string[], isMultiple: boolean) => {
    if (!user || !hasManagerAccess) return;

    const pollData: PollData = {
      question,
      options: options.map((opt, i) => ({
        id: `opt_${Date.now()}_${i}`,
        text: opt,
        voter_ids: [],
      })),
      is_multiple: isMultiple,
      is_closed: false,
    };

    await sendCommunityMessage({
      courseId,
      senderId: user.id,
      senderRole: currentRole,
      senderName: profile?.full_name_ar || profile?.full_name || (currentRole === 'admin' ? 'إدارة جسوركم' : 'معلم الدورة'),
      senderAvatar: profile?.avatar_url || null,
      content: `📊 استطلاع رأي: ${question}`,
      messageType: 'poll',
      pollData,
    });

    await loadData();
    scrollToBottom();
  };

  // Vote on poll
  const handleVote = async (messageId: string, optionId: string) => {
    if (!user) {
      toast.error('يرجى تسجيل الدخول للتصويت');
      return;
    }

    try {
      await voteOnPoll(courseId, messageId, optionId, user.id);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'تعذر التصويت');
    }
  };

  // Close poll
  const handleClosePoll = async (messageId: string) => {
    if (!hasManagerAccess) return;
    try {
      await closePoll(courseId, messageId);
      toast.success('تم إغلاق الاستطلاع وتثبيت النتائج');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشل إغلاق الاستطلاع');
    }
  };

  // Pin message
  const handlePin = async (messageId: string, currentPinStatus: boolean) => {
    if (!user || !hasManagerAccess) return;
    try {
      await togglePinMessage(courseId, messageId, !currentPinStatus, user.id);
      toast.success(!currentPinStatus ? 'تم تثبيت الرسالة كإعلان للقروب' : 'تم إلغاء تثبيت الرسالة');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشل تحديث التثبيت');
    }
  };

  // Delete message
  const handleDelete = async (messageId: string) => {
    try {
      await deleteCommunityMessage(courseId, messageId, false);
      toast.success('تم حذف الرسالة');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف الرسالة');
    }
  };

  // Mute student
  const handleMute = async (studentId: string) => {
    if (!user || !hasManagerAccess) return;
    try {
      await toggleMuteStudent(courseId, studentId, true, user.id);
      toast.success('تم كتم الطالب في هذا القروب');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'فشل كتم الطالب');
    }
  };

  // Copy text
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ النص');
  };

  // Format date headers
  const formatDateHeader = (isoString: string) => {
    const d = new Date(isoString);
    if (isToday(d)) return 'اليوم';
    if (isYesterday(d)) return 'أمس';
    return format(d, 'EEEE، d MMMM yyyy', { locale: ar });
  };

  // Filter messages for search
  const visibleMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const pinnedMessage = messages.find((m) => m.id === settings.pinned_message_id || m.is_pinned);

  return (
    <div
      className={`flex flex-col h-[650px] max-h-[85vh] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden font-sans ${className}`}
      dir="rtl"
    >
      {/* 1. Header (WhatsApp style) */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-10 h-10 border-2 border-indigo-500/20 shadow-sm">
            <AvatarImage src={thumbnailUrl || undefined} alt={courseTitle} />
            <AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-sm">
              {courseTitle.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[320px]">
                {courseTitle}
              </h3>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-4 ${
                  settings.is_chat_muted
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {settings.is_chat_muted ? '🔒 إعلانات فقط' : '🟢 شات نشط'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
              {instructorName ? (
                <>
                  <span>المعلم: {instructorName}</span>
                  <span>•</span>
                </>
              ) : null}
              <span>{messages.length} رسالة</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="w-8 h-8 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="بحث في الرسائل"
          >
            <Search className="w-4 h-4" />
          </Button>

          {hasManagerAccess && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 relative"
              title="إعدادات القروب وتحكم المعلم"
            >
              <Settings className="w-4 h-4" />
              {isSuperAdmin && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar Overlay */}
      {isSearchOpen && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <Input
            placeholder="ابحث في رسائل القروب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs bg-white dark:bg-slate-900"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
            className="w-7 h-7 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Pinned Announcement Bar */}
      {pinnedMessage && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/40 px-3 py-1.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 truncate">
            <Megaphone className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-bold text-[11px] flex-shrink-0">إعلان مثبت:</span>
            <span className="truncate text-[11px] text-slate-700 dark:text-slate-300">
              {pinnedMessage.content}
            </span>
          </div>
          {hasManagerAccess && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handlePin(pinnedMessage.id, true)}
              className="text-[10px] h-6 px-2 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              إلغاء التثبيت
            </Button>
          )}
        </div>
      )}

      {/* 2. Chat Messages Stream */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/20 dark:bg-[#0b141a]/40"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgba(99, 102, 241, 0.03) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs gap-2">
            <span className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
            جارٍ تحميل المحادثات...
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-2 p-6">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              أهلاً بك في قروب مجتمع الدورة!
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              هنا يمكنك التواصل ومناقشة الدروس مع معلم الدورة وزملائك الطلاب، والمشاركة في استطلاعات الرأي.
            </p>
          </div>
        ) : (
          visibleMessages.map((msg, index) => {
            const isMe = user?.id === msg.sender_id;
            const isMsgInstructor = msg.sender_role === 'instructor';
            const isMsgAdmin = msg.sender_role === 'admin';

            // Show date separator if first or different from prev date
            const showDateHeader =
              index === 0 ||
              format(new Date(msg.created_at), 'yyyy-MM-dd') !==
                format(new Date(visibleMessages[index - 1].created_at), 'yyyy-MM-dd');

            return (
              <React.Fragment key={msg.id}>
                {showDateHeader && (
                  <div className="flex justify-center my-3">
                    <span className="bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full shadow-xs">
                      {formatDateHeader(msg.created_at)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex gap-2 max-w-[85%] sm:max-w-[75%] ${
                    isMe ? 'mr-auto flex-row' : 'ml-auto flex-row'
                  }`}
                >
                  {/* Sender Avatar */}
                  {!isMe && (
                    <Avatar className="w-8 h-8 mt-1 flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <AvatarImage src={msg.sender_avatar || undefined} />
                      <AvatarFallback
                        className={`text-[11px] font-bold text-white ${
                          isMsgAdmin
                            ? 'bg-rose-600'
                            : isMsgInstructor
                            ? 'bg-amber-600'
                            : 'bg-slate-600'
                        }`}
                      >
                        {msg.sender_name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`relative rounded-2xl px-3.5 py-2 text-right shadow-xs transition-all ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : isMsgAdmin
                        ? 'bg-gradient-to-br from-rose-50 to-purple-50 dark:from-rose-950/30 dark:to-purple-950/30 border border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                        : isMsgInstructor
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900/50 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                    }`}
                  >
                    {/* Bubble Header: Sender Name & Role Badge */}
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-xs font-bold truncate max-w-[150px] ${
                            isMsgAdmin
                              ? 'text-rose-700 dark:text-rose-300'
                              : isMsgInstructor
                              ? 'text-amber-800 dark:text-amber-300'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {msg.sender_name}
                        </span>

                        {isMsgAdmin && (
                          <Badge className="bg-rose-600 text-white text-[9px] px-1 py-0 h-3.5 flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            إدارة المنصة
                          </Badge>
                        )}
                        {isMsgInstructor && (
                          <Badge className="bg-amber-600 text-white text-[9px] px-1 py-0 h-3.5">
                            👨‍🏫 المعلم
                          </Badge>
                        )}
                        {msg.is_pinned && (
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500 mr-auto" />
                        )}
                      </div>
                    )}

                    {/* Quoted Reply if present */}
                    {msg.reply_to && (
                      <div
                        className={`mb-2 p-1.5 rounded text-xs border-r-2 ${
                          isMe
                            ? 'bg-indigo-700/50 border-white text-indigo-100'
                            : 'bg-slate-100 dark:bg-slate-900/60 border-indigo-500 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <p className="font-bold text-[10px] opacity-90">
                          {msg.reply_to.sender_name}
                        </p>
                        <p className="truncate text-[11px]">{msg.reply_to.content}</p>
                      </div>
                    )}

                    {/* Message Body based on type */}
                    {msg.is_deleted ? (
                      <p className="italic text-xs opacity-60 flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> {msg.content}
                      </p>
                    ) : msg.message_type === 'image' && msg.file_url ? (
                      <div className="space-y-1.5">
                        <img
                          src={msg.file_url}
                          alt={msg.file_name || 'مرفق'}
                          onClick={() => setSelectedImage(msg.file_url!)}
                          className="max-h-60 max-w-full rounded-lg object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        />
                        {msg.content && msg.content !== '📷 صورة' && (
                          <p className="text-xs break-words">{msg.content}</p>
                        )}
                      </div>
                    ) : msg.message_type === 'file' && msg.file_url ? (
                      <div className="space-y-1">
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2.5 p-2 rounded-lg border ${
                            isMe
                              ? 'bg-indigo-700/40 border-indigo-500 text-white'
                              : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <FileText className="w-6 h-6 text-indigo-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">
                              {msg.file_name || 'مستند مرفق'}
                            </p>
                            {msg.file_size ? (
                              <p className="text-[10px] opacity-70">
                                {(msg.file_size / 1024).toFixed(1)} KB
                              </p>
                            ) : null}
                          </div>
                          <Download className="w-4 h-4 opacity-80" />
                        </a>
                      </div>
                    ) : msg.message_type === 'poll' && msg.poll_data ? (
                      /* Interactive Poll Card */
                      <div className="w-64 sm:w-72 space-y-2.5 py-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold flex items-center gap-1">
                            <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                            {msg.poll_data.question}
                          </span>
                          {msg.poll_data.is_closed && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-400">
                              مغلق
                            </Badge>
                          )}
                        </div>

                        {/* Poll Options */}
                        <div className="space-y-1.5">
                          {(() => {
                            const totalVotes = msg.poll_data.options.reduce(
                              (acc, opt) => acc + (opt.voter_ids?.length || 0),
                              0
                            );

                            return msg.poll_data.options.map((opt) => {
                              const count = opt.voter_ids?.length || 0;
                              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                              const hasVoted = user?.id && opt.voter_ids?.includes(user.id);

                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  disabled={!!msg.poll_data?.is_closed}
                                  onClick={() => handleVote(msg.id, opt.id)}
                                  className={`w-full relative overflow-hidden rounded-lg p-2 text-right transition-all border text-xs flex items-center justify-between ${
                                    hasVoted
                                      ? 'border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 font-bold'
                                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100'
                                  }`}
                                >
                                  {/* Percentage Fill Bar */}
                                  <div
                                    className={`absolute inset-y-0 right-0 opacity-20 pointer-events-none transition-all duration-300 ${
                                      hasVoted ? 'bg-indigo-600' : 'bg-slate-400'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />

                                  <span className="relative z-10 truncate pr-1">
                                    {opt.text}
                                  </span>

                                  <div className="relative z-10 flex items-center gap-1 text-[11px] opacity-80 flex-shrink-0">
                                    <span>%{pct}</span>
                                    <span className="text-[10px]">({count})</span>
                                    {hasVoted && (
                                      <Check className="w-3 h-3 text-indigo-600" />
                                    )}
                                  </div>
                                </button>
                              );
                            });
                          })()}
                        </div>

                        {/* Poll Footer */}
                        <div className="flex items-center justify-between text-[10px] opacity-70 pt-1">
                          <span>
                            إجمالي الأصوات:{' '}
                            {msg.poll_data.options.reduce(
                              (acc, opt) => acc + (opt.voter_ids?.length || 0),
                              0
                            )}
                          </span>
                          {hasManagerAccess && !msg.poll_data.is_closed && (
                            <button
                              type="button"
                              onClick={() => handleClosePoll(msg.id)}
                              className="text-red-500 hover:underline"
                            >
                              إغلاق التصويت
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Standard Text */
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                      </p>
                    )}

                    {/* Timestamp & status ticks */}
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMe ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      <span>{format(new Date(msg.created_at), 'h:mm a', { locale: ar })}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-indigo-200" />}

                      {/* Dropdown Menu actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-0.5 rounded hover:bg-black/10 focus:outline-hidden mr-1"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="text-xs text-right">
                          <DropdownMenuItem
                            onClick={() =>
                              setReplyingTo({
                                id: msg.id,
                                sender_name: msg.sender_name,
                                content: msg.content,
                                message_type: msg.message_type,
                              })
                            }
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            رد مقتبس
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleCopy(msg.content)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            نسخ النص
                          </DropdownMenuItem>

                          {hasManagerAccess && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handlePin(msg.id, !!msg.is_pinned)}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Pin className="w-3.5 h-3.5" />
                                {msg.is_pinned ? 'إلغاء التثبيت' : 'تثبيت كإعلان للقروب'}
                              </DropdownMenuItem>

                              {!isMe && msg.sender_role === 'student' && (
                                <DropdownMenuItem
                                  onClick={() => handleMute(msg.sender_id)}
                                  className="flex items-center gap-2 text-amber-600 cursor-pointer"
                                >
                                  <VolumeX className="w-3.5 h-3.5" />
                                  كتم الطالب في القروب
                                </DropdownMenuItem>
                              )}
                            </>
                          )}

                          {(hasManagerAccess || isMe) && !msg.is_deleted && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(msg.id)}
                                className="flex items-center gap-2 text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                حذف الرسالة
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Bottom Input Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        {/* If user is muted */}
        {isCurrentStudentMuted ? (
          <div className="flex items-center justify-center gap-2 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
            <VolumeX className="w-4 h-4 flex-shrink-0" />
            <span>تم كتم حسابك في هذا القروب من قِبل المعلم، لا يمكنك إرسال الرسائل.</span>
          </div>
        ) : !canStudentSendMessages ? (
          /* If group is closed by instructor */
          <div className="flex items-center justify-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>المحادثة مغلقة حالياً من قِبل المعلم (وضع الإعلانات فقط والقراءة للطلاب).</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Replying banner */}
            {replyingTo && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-r-4 border-indigo-500 rounded-lg text-xs">
                <div className="truncate">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    الرد على {replyingTo.sender_name}:{' '}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 truncate">
                    {replyingTo.content}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={(e) => handleFileUpload(e, true)}
              className="hidden"
            />
            <input
              type="file"
              ref={docInputRef}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
              onChange={(e) => handleFileUpload(e, false)}
              className="hidden"
            />

            <div className="flex items-end gap-2">
              {/* Attach Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={sending || uploading}
                    className="h-10 w-10 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0 rounded-full"
                    title="إرفاق ملف أو إنشاء تصويت"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs text-right">
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canStudentSendMedia}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    <span>إرسال صورة</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => docInputRef.current?.click()}
                    disabled={!canStudentSendMedia}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span>إرسال مستند / ملف</span>
                  </DropdownMenuItem>

                  {hasManagerAccess && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setPollDialogOpen(true)}
                        className="flex items-center gap-2 text-indigo-600 font-semibold cursor-pointer"
                      >
                        <BarChart2 className="w-4 h-4 text-indigo-600" />
                        <span>إنشاء استطلاع رأي / تصويت 📊</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Text Input */}
              <div className="flex-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 border border-transparent focus-within:border-indigo-500">
                <Textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="اكتب رسالتك في قروب الدورة..."
                  rows={1}
                  className="w-full text-xs sm:text-sm bg-transparent border-0 resize-none p-1 focus-visible:ring-0 focus-visible:ring-offset-0 max-h-24 min-h-[36px]"
                  dir="rtl"
                />
              </div>

              {/* Send Button */}
              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sending || uploading}
                size="icon"
                className="h-10 w-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex-shrink-0 shadow-md transition-transform active:scale-95"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4 ml-0.5" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox image dialog */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl p-1 bg-black/90 border-0 flex items-center justify-center">
            <img
              src={selectedImage}
              alt="صورة مكبرة"
              className="max-h-[85vh] max-w-full rounded object-contain"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Settings Dialog */}
      <CourseCommunitySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        courseId={courseId}
        courseTitle={courseTitle}
        currentUserId={user?.id || ''}
        isSuperAdmin={isSuperAdmin}
        onSettingsSaved={(newStgs) => setSettings(newStgs)}
      />

      {/* Create Poll Dialog */}
      <CreatePollDialog
        open={pollDialogOpen}
        onOpenChange={setPollDialogOpen}
        onSubmit={handleCreatePoll}
      />
    </div>
  );
};
