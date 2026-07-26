import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InstructorMessagesSkeleton } from '@/components/ui/skeletons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Search, ArrowLeft, BookOpen, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRef } from 'react';

interface CourseMessage {
  id: string;
  content: string | null;
  sender_id: string;
  receiver_id: string;
  course_id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  is_read: boolean;
}

interface CourseGroup {
  course_id: string;
  course_title: string;
  students: StudentConversation[];
  total_unread: number;
}

interface StudentConversation {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  course_id: string;
}

type ViewState = 'courses' | 'students' | 'chat';

export const InstructorMessages = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';

  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseGroup | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentConversation | null>(null);
  const [messages, setMessages] = useState<CourseMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewState, setViewState] = useState<ViewState>('courses');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = language === 'ar' ? {
    title: 'محادثات الدورات',
    searchPlaceholder: 'ابحث...',
    noConversations: 'لا توجد محادثات',
    noMessages: 'لا توجد رسائل',
    typeMessage: 'اكتب رسالتك...',
    send: 'إرسال',
    back: 'رجوع',
    unread: 'غير مقروءة',
    students: 'طالب',
    fromCourse: 'من دورة',
  } : {
    title: 'Course Conversations',
    searchPlaceholder: 'Search...',
    noConversations: 'No conversations',
    noMessages: 'No messages',
    typeMessage: 'Type your message...',
    send: 'Send',
    back: 'Back',
    unread: 'unread',
    students: 'students',
    fromCourse: 'from course',
  };

  useEffect(() => {
    if (user) fetchCourseMessages();
  }, [user]);

  useEffect(() => {
    if (selectedStudent && user) {
      fetchChatMessages();
      markAsRead();

      const channel = supabase
        .channel(`instructor-chat-${selectedStudent.course_id}-${selectedStudent.user_id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'course_messages',
          filter: `course_id=eq.${selectedStudent.course_id}`,
        }, (payload) => {
          const msg = payload.new as CourseMessage;
          if (msg.sender_id === selectedStudent.user_id || msg.receiver_id === selectedStudent.user_id) {
            setMessages(prev => [...prev, msg]);
            if (msg.sender_id !== user.id) markAsRead();
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchCourseMessages = async () => {
    if (!user) { setLoading(false); return; }
    try {
      // Only fetch messages where the instructor is a party (sender or receiver).
      // RLS also enforces this, but scoping the query keeps unrelated rows out.
      const { data: allMessages, error } = await supabase
        .from('course_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!allMessages || allMessages.length === 0) { setLoading(false); return; }

      // Get unique course IDs
      const courseIds = [...new Set(allMessages.map(m => m.course_id))];
      
      // Fetch course titles
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .in('id', courseIds);

      const courseMap = new Map(courses?.map(c => [c.id, language === 'ar' ? c.title_ar : c.title]) || []);

      // Group by course then by student
      const groupMap = new Map<string, { messages: CourseMessage[], studentIds: Set<string> }>();

      for (const msg of allMessages) {
        if (!groupMap.has(msg.course_id)) {
          groupMap.set(msg.course_id, { messages: [], studentIds: new Set() });
        }
        const group = groupMap.get(msg.course_id)!;
        group.messages.push(msg as CourseMessage);
        const studentId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
        group.studentIds.add(studentId);
      }

      // Fetch all student profiles
      const allStudentIds = [...new Set(allMessages.flatMap(m => [m.sender_id, m.receiver_id]).filter(id => id !== user?.id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, avatar_url')
        .in('id', allStudentIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const groups: CourseGroup[] = [];

      for (const [courseId, { messages: msgs, studentIds }] of groupMap) {
        const students: StudentConversation[] = [];

        for (const studentId of studentIds) {
          const studentMsgs = msgs.filter(m => m.sender_id === studentId || m.receiver_id === studentId);
          const profile = profileMap.get(studentId);
          const unread = studentMsgs.filter(m => m.receiver_id === user?.id && !m.is_read).length;
          const lastMsg = studentMsgs[0];

          students.push({
            user_id: studentId,
            user_name: profile ? (language === 'ar' ? profile.full_name_ar || profile.full_name || '' : profile.full_name || '') : '',
            avatar_url: profile?.avatar_url || null,
            last_message: lastMsg.content || (lastMsg.file_name ? `📎 ${lastMsg.file_name}` : ''),
            last_message_time: lastMsg.created_at,
            unread_count: unread,
            course_id: courseId,
          });
        }

        students.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

        groups.push({
          course_id: courseId,
          course_title: courseMap.get(courseId) || courseId,
          students,
          total_unread: students.reduce((s, st) => s + st.unread_count, 0),
        });
      }

      groups.sort((a, b) => b.total_unread - a.total_unread);
      setCourseGroups(groups);
    } catch (error) {
      console.error('Error fetching course messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMessages = async () => {
    if (!selectedStudent || !user) return;
    const { data, error } = await supabase
      .from('course_messages')
      .select('*')
      .eq('course_id', selectedStudent.course_id)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedStudent.user_id}),and(sender_id.eq.${selectedStudent.user_id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (!error) setMessages((data as CourseMessage[]) || []);
  };

  const markAsRead = async () => {
    if (!selectedStudent || !user) return;
    await supabase
      .from('course_messages')
      .update({ is_read: true })
      .eq('course_id', selectedStudent.course_id)
      .eq('sender_id', selectedStudent.user_id)
      .eq('receiver_id', user.id);
  };

  const sendMessage = async (content?: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    const msgContent = content?.trim();
    if ((!msgContent && !fileUrl) || !selectedStudent || !user) return;

    try {
      const { error } = await supabase.from('course_messages').insert({
        course_id: selectedStudent.course_id,
        sender_id: user.id,
        receiver_id: selectedStudent.user_id,
        content: msgContent || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(language === 'ar' ? 'فشل إرسال الرسالة' : 'Failed to send message');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedStudent) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10MB' : 'Max 10MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${selectedStudent.course_id}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
      await sendMessage(undefined, publicUrl, file.name, file.type);
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل رفع الملف' : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const goBack = () => {
    if (viewState === 'chat') { setSelectedStudent(null); setViewState('students'); setMessages([]); }
    else if (viewState === 'students') { setSelectedCourse(null); setViewState('courses'); }
  };

  const filteredGroups = courseGroups.filter(g =>
    g.course_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.students.some(s => s.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return <InstructorMessagesSkeleton />;

  const isImage = (type: string | null) => type?.startsWith('image/');

  return (
    <Card className="h-[calc(100vh-200px)] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex overflow-hidden p-0">
        <AnimatePresence mode="wait">
          {viewState === 'courses' && (
            <motion.div key="courses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="ps-10" />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {filteredGroups.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t.noConversations}</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredGroups.map((group) => (
                      <button
                        key={group.course_id}
                        onClick={() => { setSelectedCourse(group); setViewState('students'); }}
                        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-start"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{group.course_title}</h4>
                          <p className="text-sm text-muted-foreground">{group.students.length} {t.students}</p>
                        </div>
                        {group.total_unread > 0 && <Badge className="bg-primary">{group.total_unread}</Badge>}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          )}

          {viewState === 'students' && selectedCourse && (
            <motion.div key="students" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="w-full flex flex-col">
              <div className="p-4 border-b flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={goBack}>
                  <ArrowLeft className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </Button>
                <div>
                  <h4 className="font-medium">{selectedCourse.course_title}</h4>
                  <p className="text-sm text-muted-foreground">{selectedCourse.students.length} {t.students}</p>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {selectedCourse.students.map((student) => (
                    <button
                      key={student.user_id}
                      onClick={() => { setSelectedStudent(student); setViewState('chat'); }}
                      className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-start"
                    >
                      <Avatar>
                        <AvatarImage src={student.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-gold text-primary-foreground">{student.user_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">{student.user_name}</h4>
                          <span className="text-xs text-muted-foreground">{format(new Date(student.last_message_time), 'HH:mm')}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{student.last_message}</p>
                      </div>
                      {student.unread_count > 0 && <Badge className="bg-primary">{student.unread_count}</Badge>}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}

          {viewState === 'chat' && selectedStudent && (
            <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="w-full flex flex-col">
              <div className="p-4 border-b flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={goBack}>
                  <ArrowLeft className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </Button>
                <Avatar>
                  <AvatarImage src={selectedStudent.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-gold text-primary-foreground">{selectedStudent.user_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium">{selectedStudent.user_name}</h4>
                  <p className="text-xs text-muted-foreground">{selectedCourse?.course_title}</p>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground"><p>{t.noMessages}</p></div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isMine = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-2xl ${isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                            {msg.file_url && (
                              <div className="mb-2">
                                {isImage(msg.file_type) ? (
                                  <img src={msg.file_url} alt="" className="rounded-lg max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.file_url!, '_blank')} />
                                ) : (
                                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded bg-background/20">
                                    <FileText className="h-4 w-4" />
                                    <span className="text-sm truncate">{msg.file_name}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {msg.content && <p>{msg.content}</p>}
                            <p className={`text-xs mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex gap-2 items-end">
                <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Textarea
                  placeholder={t.typeMessage}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[44px] max-h-32 resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(newMessage); } }}
                />
                <Button size="icon" onClick={() => sendMessage(newMessage)} disabled={!newMessage.trim()} className="bg-gradient-gold h-11 w-11">
                  <Send className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
