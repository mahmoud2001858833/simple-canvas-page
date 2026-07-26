import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones, X, Minimize2, Maximize2, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface Message {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
  is_read: boolean | null;
  admin_internal?: boolean | null;
}

// Global state for opening chat from outside
let globalSetIsOpen: ((open: boolean) => void) | null = null;

export function openDirectSupportChat() {
  if (globalSetIsOpen) {
    globalSetIsOpen(true);
  }
}

export function DirectSupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const isRTL = language === "ar";

  // Generate or retrieve session ID using cryptographically secure random
  const getSessionId = useCallback(() => {
    let sessionId = sessionStorage.getItem("support-session-id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("support-session-id", sessionId);
    }
    return sessionId;
  }, []);

  // Register global setter
  useEffect(() => {
    globalSetIsOpen = setIsOpen;
    return () => {
      globalSetIsOpen = null;
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Load existing chat and messages
  useEffect(() => {
    if (!isOpen) return;

    const loadChat = async () => {
      setIsLoading(true);
      try {
        const sessionId = getSessionId();
        
        // Check for existing chat
        const { data: existingChat } = await supabase
          .from("support_chats")
          .select("id")
          .eq("session_id", sessionId)
          .eq("status", "active")
          .maybeSingle();

        if (existingChat) {
          setChatId(existingChat.id);
          
          // Load messages
          const { data: messagesData } = await supabase
            .from("support_messages")
            .select("*")
            .eq("chat_id", existingChat.id)
            .order("created_at", { ascending: true });

          if (messagesData) {
            const visible = messagesData.filter(m => !m.admin_internal);
            setMessages(visible);
            
            // Mark admin messages as read
            const unreadAdminMessages = visible.filter(m => m.sender_type === 'admin' && !m.is_read);
            if (unreadAdminMessages.length > 0) {
              await supabase
                .from("support_messages")
                .update({ is_read: true })
                .in("id", unreadAdminMessages.map(m => m.id));
            }
          }
        }
      } catch (error) {
        console.error("Error loading chat:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChat();
  }, [isOpen, getSessionId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`support-messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.admin_internal) return; // hide internal admin notes from student
          setMessages(prev => [...prev, newMessage]);
          
          // Mark as read if from admin and chat is open
          if (newMessage.sender_type === 'admin' && isOpen) {
            await supabase
              .from("support_messages")
              .update({ is_read: true })
              .eq("id", newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, isOpen]);

  // Fetch unread count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const sessionId = getSessionId();
      
      const { data: chat } = await supabase
        .from("support_chats")
        .select("id")
        .eq("session_id", sessionId)
        .eq("status", "active")
        .maybeSingle();

      if (chat) {
        const { count } = await supabase
          .from("support_messages")
          .select("*", { count: 'exact', head: true })
          .eq("chat_id", chat.id)
          .eq("sender_type", "admin")
          .eq("is_read", false);

        setUnreadCount(count || 0);
      }
    };

    fetchUnreadCount();
    
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user, getSessionId]);

  const createOrGetChat = async () => {
    if (chatId) return chatId;

    const sessionId = getSessionId();
    
    // Create new chat
    const { data: newChat, error } = await supabase
      .from("support_chats")
      .insert({
        user_id: user?.id || null,
        session_id: sessionId,
        user_name: profile?.full_name || profile?.full_name_ar || null,
        user_email: profile?.email || null,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating chat:", error);
      return null;
    }

    setChatId(newChat.id);
    return newChat.id;
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    try {
      const currentChatId = await createOrGetChat();
      if (!currentChatId) throw new Error("Failed to create chat");

      const { error } = await supabase.from("support_messages").insert({
        chat_id: currentChatId,
        sender_type: "user",
        sender_id: user?.id || null,
        content: inputValue.trim(),
      });

      if (error) throw error;

      // Update chat's last message
      await supabase
        .from("support_chats")
        .update({
          last_message: inputValue.substring(0, 100),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", currentChatId);

      setInputValue('');
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), "HH:mm", {
      locale: isRTL ? ar : enUS,
    });
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-24 z-50"
            style={{ [isRTL ? "left" : "right"]: "1.5rem" }}
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-12 w-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
            >
              <Headphones className="h-5 w-5 text-white" />
            </Button>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full flex items-center justify-center text-xs text-white font-bold"
              >
                {unreadCount}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? "auto" : "min(500px, 70vh)",
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25 }}
            className={cn(
              "fixed bottom-24 z-50 w-[340px] max-w-[calc(100vw-3rem)] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col",
            )}
            style={{ [isRTL ? "left" : "right"]: "1.5rem" }}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Headphones className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {isRTL ? "الدعم الفني" : "Support Chat"}
                  </h3>
                  <p className="text-white/80 text-xs">
                    {isRTL ? "تحدث معنا مباشرة" : "Chat with us directly"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                >
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <>
                <ScrollArea className="flex-1 h-full" ref={scrollRef}>
                  <div className="p-4 space-y-4">
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8">
                        <Headphones className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          {isRTL 
                            ? "مرحباً! كيف يمكننا مساعدتك؟"
                            : "Hello! How can we help you?"}
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.sender_type === 'user' ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-2xl px-4 py-2.5",
                              msg.sender_type === 'user'
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={cn(
                              "text-xs mt-1",
                              msg.sender_type === 'user' 
                                ? "text-primary-foreground/70" 
                                : "text-muted-foreground"
                            )}>
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-3 border-t bg-muted/30">
                  <div className="flex gap-2">
                    <Textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={isRTL ? "اكتب رسالتك..." : "Type your message..."}
                      className="min-h-[40px] max-h-[100px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button 
                      onClick={sendMessage} 
                      disabled={!inputValue.trim() || isSending}
                      size="icon"
                      className="shrink-0"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
