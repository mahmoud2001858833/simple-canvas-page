import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Paperclip, X, Image as ImageIcon, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

interface CourseChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  instructorId: string;
  courseName: string;
}

interface ChatMessage {
  id: string;
  content: string | null;
  sender_id: string;
  receiver_id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  is_read: boolean;
  created_at: string;
}

export const CourseChat = ({ open, onOpenChange, courseId, instructorId, courseName }: CourseChatProps) => {
  const { user } = useAuth();
  const { dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      fetchMessages();
      markAsRead();

      const channel = supabase
        .channel(`course-chat-${courseId}-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'course_messages',
          filter: `course_id=eq.${courseId}`,
        }, (payload) => {
          const msg = payload.new as ChatMessage;
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            setMessages(prev => [...prev, msg]);
            if (msg.sender_id !== user.id) markAsRead();
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [open, user, courseId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('course_messages')
      .select('*')
      .eq('course_id', courseId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true });

    if (!error && data) setMessages(data as ChatMessage[]);
  };

  const markAsRead = async () => {
    if (!user) return;
    await supabase
      .from('course_messages')
      .update({ is_read: true })
      .eq('course_id', courseId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);
  };

  const sendMessage = async (content?: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    if (!user) return;
    const msgContent = content?.trim();
    if (!msgContent && !fileUrl) return;

    setSending(true);
    try {
      const { error } = await supabase.from('course_messages').insert({
        course_id: courseId,
        sender_id: user.id,
        receiver_id: instructorId,
        content: msgContent || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
      toast.error(isRTL ? 'فشل إرسال الرسالة' : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? 'الحد الأقصى 10MB' : 'Max file size is 10MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const safeName = file.name
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .slice(0, 80);
      const path = `${user.id}/${courseId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(path);

      await sendMessage(undefined, publicUrl, file.name, file.type);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(isRTL ? 'فشل رفع الملف' : 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isImage = (type: string | null) => type?.startsWith('image/');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {isRTL ? 'محادثة الدورة' : 'Course Chat'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{courseName}</p>
        </DialogHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{isRTL ? 'ابدأ المحادثة مع المعلم' : 'Start chatting with the instructor'}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl p-3 ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}>
                    {msg.file_url && (
                      <div className="mb-2">
                        {isImage(msg.file_type) ? (
                          <img src={msg.file_url} alt={msg.file_name || ''} className="rounded-lg max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.file_url!, '_blank')} />
                        ) : (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-background/20 hover:bg-background/30 transition-colors">
                            <FileText className="h-5 w-5 flex-shrink-0" />
                            <span className="text-sm truncate">{msg.file_name || 'File'}</span>
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content && <p className="text-sm">{msg.content}</p>}
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {format(new Date(msg.created_at), 'HH:mm', { locale: isRTL ? ar : enUS })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t flex-shrink-0 flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Textarea
            placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[44px] max-h-24 resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(newMessage);
              }
            }}
          />
          <Button
            size="icon"
            onClick={() => sendMessage(newMessage)}
            disabled={(!newMessage.trim() && !uploading) || sending}
            className="flex-shrink-0"
          >
            <Send className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
