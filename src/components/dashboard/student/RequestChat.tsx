import { useEffect, useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MessageCircle, Send, Loader2, Image as ImageIcon, X, Paperclip, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Message {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

interface RequestChatProps {
  requestId: string;
  requestTitle: string;
}

export const RequestChat = ({ requestId, requestTitle }: RequestChatProps) => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const texts = {
    ar: {
      chat: 'المحادثة',
      typeMessage: 'اكتب رسالتك...',
      send: 'إرسال',
      noMessages: 'لا توجد رسائل بعد. ابدأ المحادثة مع فريق الدعم!',
      supportTeam: 'فريق الدعم',
      you: 'أنت',
      today: 'اليوم',
      yesterday: 'أمس',
      messageSent: 'تم إرسال الرسالة',
      errorSending: 'فشل إرسال الرسالة',
      typing: 'يكتب...',
      attachImage: 'إرفاق صورة',
      imageUploaded: 'تم رفع الصورة',
      uploadError: 'فشل رفع الصورة',
      online: 'متصل',
      offline: 'غير متصل',
    },
    en: {
      chat: 'Chat',
      typeMessage: 'Type your message...',
      send: 'Send',
      noMessages: 'No messages yet. Start a conversation with support!',
      supportTeam: 'Support Team',
      you: 'You',
      today: 'Today',
      yesterday: 'Yesterday',
      messageSent: 'Message sent',
      errorSending: 'Failed to send message',
      typing: 'typing...',
      attachImage: 'Attach image',
      imageUploaded: 'Image uploaded',
      uploadError: 'Failed to upload image',
      online: 'Online',
      offline: 'Offline',
    },
  };

  const t = texts[language];

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      markAsRead();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`request-messages-${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'request_messages',
            filter: `request_id=eq.${requestId}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            fetchSenderInfo(newMsg);
            if (newMsg.sender_id !== user?.id) {
              playNotificationSound();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'request_messages',
            filter: `request_id=eq.${requestId}`,
          },
          (payload) => {
            const updatedMsg = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, is_read: updatedMsg.is_read } : m));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, requestId, user?.id, playNotificationSound]);

  useEffect(() => {
    fetchUnreadCount();
  }, [requestId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchUnreadCount = async () => {
    const { count } = await supabase
      .from('request_messages')
      .select('*', { count: 'exact', head: true })
      .eq('request_id', requestId)
      .eq('is_read', false)
      .neq('sender_id', user?.id);
    
    setUnreadCount(count || 0);
  };

  const fetchSenderInfo = async (msg: Message) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, email')
      .eq('id', msg.sender_id)
      .single();

    setMessages(prev => [...prev, { ...msg, sender: profile || undefined }]);
    
    if (msg.sender_id !== user?.id) {
      markAsRead();
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('request_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithSenders = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, email')
            .eq('id', msg.sender_id)
            .single();
          return { ...msg, sender: profile || undefined };
        })
      );

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    await supabase
      .from('request_messages')
      .update({ is_read: true })
      .eq('request_id', requestId)
      .neq('sender_id', user?.id);
    
    setUnreadCount(0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(language === 'ar' ? 'حجم الصورة كبير جداً (الحد الأقصى 5MB)' : 'Image too large (max 5MB)');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage || !user?.id) return null;
    
    setUploadingImage(true);
    try {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${user.id}/${requestId}/${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, selectedImage);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(t.uploadError);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !user?.id) return;

    setSending(true);
    try {
      let messageContent = newMessage.trim();
      
      if (selectedImage) {
        const imageUrl = await uploadImage();
        if (imageUrl) {
          messageContent = messageContent 
            ? `${messageContent}\n[صورة](${imageUrl})`
            : `[صورة](${imageUrl})`;
        }
      }

      const { error } = await supabase
        .from('request_messages')
        .insert({
          request_id: requestId,
          sender_id: user.id,
          content: messageContent,
        });

      if (error) throw error;

      setNewMessage('');
      clearSelectedImage();
      toast.success(t.messageSent);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t.errorSending);
    } finally {
      setSending(false);
    }
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return format(date, 'HH:mm', { locale: language === 'ar' ? ar : enUS });
    } else if (diffDays === 1) {
      return `${t.yesterday} ${format(date, 'HH:mm', { locale: language === 'ar' ? ar : enUS })}`;
    } else {
      return format(date, 'dd/MM HH:mm', { locale: language === 'ar' ? ar : enUS });
    }
  };

  const getSenderName = (msg: Message) => {
    if (msg.sender_id === user?.id) return t.you;
    return msg.sender?.full_name || msg.sender?.email || t.supportTeam;
  };

  const renderMessageContent = (content: string) => {
    // Check for image links
    const imageRegex = /\[صورة\]\((https?:\/\/[^\)]+)\)/g;
    const parts = content.split(imageRegex);
    const matches = [...content.matchAll(imageRegex)];
    
    if (matches.length === 0) {
      return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
    }

    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (i % 2 === 0 && part.trim()) {
            return <p key={i} className="text-sm whitespace-pre-wrap break-words">{part}</p>;
          }
          if (i % 2 === 1) {
            return (
              <img 
                key={i}
                src={part} 
                alt="صورة" 
                className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(part, '_blank')}
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative group">
          <MessageCircle className="w-4 h-4 me-2 group-hover:scale-110 transition-transform" />
          {t.chat}
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -end-2 h-5 min-w-5 px-1 flex items-center justify-center bg-primary text-primary-foreground text-xs rounded-full"
            >
              {unreadCount}
            </motion.span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent 
        side={dir === 'rtl' ? 'left' : 'right'} 
        className="w-full sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="p-4 border-b shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
          <SheetTitle className="flex items-center gap-2">
            <div className="relative">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="absolute -bottom-0.5 -end-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="truncate block">{requestTitle}</span>
              <span className="text-xs text-muted-foreground font-normal">{t.online}</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
              <p className="max-w-[200px]">{t.noMessages}</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => {
                const isMine = msg.sender_id === user?.id;
                const showAvatar = !isMine && (index === 0 || messages[index - 1]?.sender_id !== msg.sender_id);
                
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[85%] ${isMine ? 'flex-row-reverse' : ''}`}>
                      {!isMine && showAvatar ? (
                        <Avatar className="w-8 h-8 shrink-0 ring-2 ring-background">
                          <AvatarImage src={msg.sender?.avatar_url || ''} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getSenderName(msg).charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ) : !isMine ? (
                        <div className="w-8" />
                      ) : null}
                      <div>
                        {!isMine && showAvatar && (
                          <p className="text-xs text-muted-foreground mb-1 font-medium">
                            {getSenderName(msg)}
                          </p>
                        )}
                        <div
                          className={`p-3 rounded-2xl shadow-sm ${
                            isMine
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-background border rounded-bl-md'
                          }`}
                        >
                          {renderMessageContent(msg.content)}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
                          <p className="text-xs text-muted-foreground">
                            {formatMessageDate(msg.created_at)}
                          </p>
                          {isMine && (
                            msg.is_read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-muted-foreground" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              
              {/* Typing Indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      S
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-background border rounded-2xl rounded-bl-md p-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Image Preview */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pt-2 border-t bg-background"
            >
              <div className="relative inline-block">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="h-20 rounded-lg object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -end-2 h-6 w-6"
                  onClick={clearSelectedImage}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="p-4 border-t shrink-0 bg-background">
          <div className="flex gap-2 items-end">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-11 w-11 text-muted-foreground hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadingImage}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Textarea
              placeholder={t.typeMessage}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[44px] max-h-32 resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={(!newMessage.trim() && !selectedImage) || sending || uploadingImage}
              className="h-11 w-11 shrink-0"
            >
              {sending || uploadingImage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};