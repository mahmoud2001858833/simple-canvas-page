import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import {
  MessageCircle,
  Send,
  User,
  Clock,
  CheckCheck,
  X,
  RefreshCw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupportChat {
  id: string;
  user_id: string | null;
  session_id: string;
  user_name: string | null;
  user_email: string | null;
  status: string;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  unread_count?: number;
}

interface SupportMessage {
  id: string;
  chat_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export const SupportChats = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRTL = language === 'ar';

  // Fetch all support chats
  const fetchChats = async () => {
    try {
      const { data, error } = await supabase
        .from('support_chats')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get unread counts for each chat
      const chatsWithUnread = await Promise.all(
        (data || []).map(async (chat) => {
          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chat.id)
            .eq('is_read', false)
            .eq('sender_type', 'user');
          
          return { ...chat, unread_count: count || 0 };
        })
      );

      setChats(chatsWithUnread);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast.error(isRTL ? 'خطأ في جلب المحادثات' : 'Error fetching chats');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for selected chat with audit logging
  const fetchMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Log admin access to user messages for audit trail
      if (user && data && data.length > 0) {
        const userMessages = data.filter(m => m.sender_type === 'user');
        if (userMessages.length > 0) {
          await supabase.from('security_audit_logs').insert({
            user_id: user.id,
            action_type: 'admin_view_support_messages',
            table_name: 'support_messages',
            record_id: chatId,
            details: {
              chat_id: chatId,
              message_count: userMessages.length,
              viewed_at: new Date().toISOString(),
            },
          });
        }
      }

      // Mark user messages as read
      await supabase
        .from('support_messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .eq('sender_type', 'user')
        .eq('is_read', false);

      // Update local unread count
      setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, unread_count: 0 } : chat
      ));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Send admin message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        chat_id: selectedChat.id,
        sender_type: 'admin',
        sender_id: user.id,
        content: newMessage.trim(),
        is_read: true,
        admin_internal: internalNote,
      } as any);

      if (error) throw error;

      // Update chat's last message
      await supabase
        .from('support_chats')
        .update({
          last_message: newMessage.trim().substring(0, 100),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', selectedChat.id);

      setNewMessage('');
      fetchMessages(selectedChat.id);
      fetchChats();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(isRTL ? 'خطأ في إرسال الرسالة' : 'Error sending message');
    } finally {
      setSending(false);
    }
  };

  // Close chat
  const closeChat = async (chatId: string) => {
    try {
      await supabase
        .from('support_chats')
        .update({ status: 'closed' })
        .eq('id', chatId);

      toast.success(isRTL ? 'تم إغلاق المحادثة' : 'Chat closed');
      fetchChats();
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error closing chat:', error);
    }
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, []);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat?.id]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-chats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        () => {
          if (selectedChat) {
            fetchMessages(selectedChat.id);
          }
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_chats' },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat?.id]);

  // Filter chats by search
  const filteredChats = chats.filter(chat => {
    const query = searchQuery.toLowerCase();
    return (
      (chat.user_name?.toLowerCase().includes(query) || false) ||
      (chat.user_email?.toLowerCase().includes(query) || false) ||
      (chat.last_message?.toLowerCase().includes(query) || false)
    );
  });

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: isRTL ? ar : enUS,
    });
  };

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {isRTL ? 'محادثات الدعم' : 'Support Chats'}
          </h2>
          <p className="text-muted-foreground">
            {isRTL ? 'إدارة محادثات العملاء والرد عليها' : 'Manage and respond to customer chats'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {totalUnread} {isRTL ? 'غير مقروءة' : 'unread'}
            </Badge>
          )}
          <Button variant="outline" size="icon" onClick={fetchChats}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
        {/* Chats List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'بحث في المحادثات...' : 'Search chats...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mb-2" />
                  <p>{isRTL ? 'لا توجد محادثات' : 'No chats'}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredChats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={cn(
                        'w-full p-4 text-start hover:bg-muted/50 transition-colors',
                        selectedChat?.id === chat.id && 'bg-muted'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">
                              {chat.user_name || (isRTL ? 'زائر' : 'Guest')}
                            </span>
                            {(chat.unread_count || 0) > 0 && (
                              <Badge variant="destructive" className="flex-shrink-0">
                                {chat.unread_count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {chat.last_message || (isRTL ? 'بدء محادثة' : 'Started chat')}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatTime(chat.last_message_at)}
                            </span>
                            <Badge
                              variant={chat.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {chat.status === 'active' 
                                ? (isRTL ? 'نشط' : 'Active') 
                                : (isRTL ? 'مغلق' : 'Closed')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat View */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {selectedChat.user_name || (isRTL ? 'زائر' : 'Guest')}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {selectedChat.user_email || selectedChat.session_id.substring(0, 20)}
                      </p>
                    </div>
                  </div>
                  {selectedChat.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeChat(selectedChat.id)}
                    >
                      <X className="h-4 w-4 me-1" />
                      {isRTL ? 'إغلاق' : 'Close'}
                    </Button>
                  )}
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex gap-3',
                          msg.sender_type === 'admin' && 'flex-row-reverse'
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                            msg.sender_type === 'admin'
                              ? 'bg-primary text-primary-foreground'
                              : msg.sender_type === 'assistant'
                              ? 'bg-gradient-ocean text-white'
                              : 'bg-muted'
                          )}
                        >
                          {msg.sender_type === 'admin' ? (
                            <CheckCheck className="h-4 w-4" />
                          ) : msg.sender_type === 'assistant' ? (
                            <MessageCircle className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl px-4 py-2.5',
                            msg.sender_type === 'admin'
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : msg.sender_type === 'assistant'
                              ? 'bg-gradient-ocean text-white rounded-tl-sm'
                              : 'bg-muted rounded-tl-sm'
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p
                            className={cn(
                              'text-xs mt-1',
                              msg.sender_type === 'admin' || msg.sender_type === 'assistant'
                                ? 'text-white/70'
                                : 'text-muted-foreground'
                            )}
                          >
                            {formatTime(msg.created_at)}
                            {msg.sender_type === 'assistant' && (
                              <span className="ms-2">
                                {isRTL ? '(المساعد الآلي)' : '(AI Assistant)'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              {selectedChat.status === 'active' && (
                <div className="p-4 border-t space-y-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={internalNote}
                      onChange={(e) => setInternalNote(e.target.checked)}
                      className="rounded"
                    />
                    {isRTL ? 'ملاحظة داخلية (لن يراها الطالب)' : 'Internal note (hidden from user)'}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={internalNote
                        ? (isRTL ? 'ملاحظة داخلية...' : 'Internal note...')
                        : (isRTL ? 'اكتب رسالتك...' : 'Type your message...')}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={sending}
                      className={internalNote ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : ''}
                    />
                    <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>)}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">
                {isRTL ? 'اختر محادثة للبدء' : 'Select a chat to start'}
              </p>
              <p className="text-sm">
                {isRTL ? 'اختر محادثة من القائمة للرد على العملاء' : 'Select a chat from the list to respond to customers'}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SupportChats;
