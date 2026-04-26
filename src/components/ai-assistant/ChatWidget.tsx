import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Minimize2, Maximize2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { QuickActions } from "./QuickActions";
import { supabase } from "@/integrations/supabase/client";

interface Course {
  id: string;
  title: string;
  title_ar: string;
  description?: string | null;
  description_ar?: string | null;
  thumbnail_url?: string | null;
  price?: number | null;
  original_price?: number | null;
  duration_hours?: number | null;
  category?: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestedPath?: string | null;
  courses?: Course[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

// Global state for opening chat from outside
let globalSetIsOpen: ((open: boolean) => void) | null = null;

export function openChatWidget() {
  if (globalSetIsOpen) {
    globalSetIsOpen(true);
  }
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { language } = useLanguage();
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRTL = language === "ar";

  // Generate or retrieve session ID using cryptographically secure random
  const getSessionId = useCallback(() => {
    let sessionId = sessionStorage.getItem("jasorkom-session-id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("jasorkom-session-id", sessionId);
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load messages from session storage
  useEffect(() => {
    const saved = sessionStorage.getItem("jasorkom-chat");
    const savedChatId = sessionStorage.getItem("jasorkom-chat-id");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // Ignore invalid JSON
      }
    }
    if (savedChatId) {
      setChatId(savedChatId);
    }
  }, []);

  // Save messages to session storage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("jasorkom-chat", JSON.stringify(messages));
    }
  }, [messages]);

  // Create or get support chat
  const ensureChatExists = useCallback(async () => {
    if (chatId) return chatId;

    const sessionId = getSessionId();
    
    // Check if chat already exists for this session
    const { data: existingChat } = await supabase
      .from("support_chats")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "active")
      .maybeSingle();

    if (existingChat) {
      setChatId(existingChat.id);
      sessionStorage.setItem("jasorkom-chat-id", existingChat.id);
      return existingChat.id;
    }

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
    sessionStorage.setItem("jasorkom-chat-id", newChat.id);
    return newChat.id;
  }, [chatId, user?.id, profile, getSessionId]);

  // Save message to database
  const saveMessageToDb = useCallback(async (
    currentChatId: string,
    senderType: "user" | "assistant",
    content: string
  ) => {
    try {
      await supabase.from("support_messages").insert({
        chat_id: currentChatId,
        sender_type: senderType,
        sender_id: senderType === "user" ? user?.id : null,
        content,
      });

      // Update chat's last message
      await supabase
        .from("support_chats")
        .update({
          last_message: content.substring(0, 100),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", currentChatId);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  }, [user?.id]);

  // Courses data cache
  const [coursesCache, setCoursesCache] = useState<Course[]>([]);

  // Fetch courses for displaying in chat
  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, title_ar, description, description_ar, thumbnail_url, price, original_price, duration_hours, category')
        .eq('is_active', true);
      if (data) setCoursesCache(data);
    };
    fetchCourses();
  }, []);

  // Extract navigation suggestions and course IDs from content
  const extractMetadata = useCallback((content: string): { 
    cleanContent: string; 
    suggestedPath: string | null;
    courseIds: string[];
  } => {
    let cleanContent = content;
    let suggestedPath: string | null = null;
    let courseIds: string[] = [];

    // Extract navigation
    const navMatch = content.match(/\{"navigate":\s*"([^"]+)"\}/);
    if (navMatch) {
      suggestedPath = navMatch[1];
      cleanContent = cleanContent.replace(/\{"navigate":\s*"[^"]+"\}/g, "").trim();
    }

    // Extract course IDs
    const coursesMatch = content.match(/\{"courses":\s*\[([^\]]+)\]\}/);
    if (coursesMatch) {
      try {
        const idsStr = coursesMatch[1];
        courseIds = idsStr.split(',').map(s => s.trim().replace(/"/g, ''));
      } catch {
        // Ignore parsing errors
      }
      cleanContent = cleanContent.replace(/\{"courses":\s*\[[^\]]+\]\}/g, "").trim();
    }

    return { cleanContent, suggestedPath, courseIds };
  }, []);

  const handleNavigationClick = useCallback((path: string) => {
    navigate(path);
    setIsOpen(false);
  }, [navigate]);

  const sendMessage = async (input: string) => {
    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Ensure chat exists and save user message
    const currentChatId = await ensureChatExists();
    if (currentChatId) {
      await saveMessageToDb(currentChatId, "user", input);
    }

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
          userContext: {
            userName: profile?.full_name || profile?.full_name_ar,
            userRole: role || "guest",
            currentPath: location.pathname,
            language,
            isLoggedIn: !!user,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Extract metadata and save assistant response after streaming is complete
      if (assistantContent) {
        const { cleanContent, suggestedPath, courseIds } = extractMetadata(assistantContent);
        
        // Find matching courses from cache
        const matchedCourses = courseIds.length > 0 
          ? coursesCache.filter(c => courseIds.includes(c.id))
          : [];
        
        // Update last message with clean content, navigation suggestion, and courses
        setMessages(prev => 
          prev.map((m, i) => 
            i === prev.length - 1 
              ? { ...m, content: cleanContent, suggestedPath, courses: matchedCourses.length > 0 ? matchedCourses : undefined } 
              : m
          )
        );
        
        // Save assistant response to database
        if (currentChatId) {
          await saveMessageToDb(currentChatId, "assistant", cleanContent);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = isRTL 
        ? "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى." 
        : "Sorry, an error occurred. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const welcomeMessage = isRTL
    ? "مرحباً! 👋 أنا مساعد جسوركم الذكي. كيف يمكنني مساعدتك اليوم؟"
    : "Hello! 👋 I'm Jasorkom's AI assistant. How can I help you today?";

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 z-50"
            style={{ [isRTL ? "left" : "right"]: "1.5rem" }}
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full bg-gradient-ocean shadow-ocean hover:shadow-lg transition-all duration-300 hover:scale-110"
            >
              <Sparkles className="h-6 w-6 text-white" />
            </Button>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1, type: "spring" }}
              className="absolute -top-1 -right-1 h-4 w-4 bg-accent rounded-full animate-pulse"
            />
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
              height: isMinimized ? "auto" : "min(600px, 80vh)",
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25 }}
            className={cn(
              "fixed bottom-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col",
            )}
            style={{ [isRTL ? "left" : "right"]: "1.5rem" }}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="bg-gradient-ocean p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {isRTL ? "مساعد جسوركم" : "Jasorkom Assistant"}
                  </h3>
                  <p className="text-white/80 text-xs">
                    {isRTL ? "متصل الآن" : "Online now"}
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
                <ScrollArea className="flex-1 h-full" ref={scrollRef as any}>
                  <div className="py-2">
                    {/* Welcome message */}
                    {messages.length === 0 && (
                      <>
                        <ChatMessage role="assistant" content={welcomeMessage} />
                        <QuickActions onAction={sendMessage} isRTL={isRTL} />
                      </>
                    )}

                    {/* Messages */}
                    {messages.map((msg, i) => (
                      <ChatMessage
                        key={i}
                        role={msg.role}
                        content={msg.content}
                        isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                        suggestedPath={msg.suggestedPath}
                        onNavigate={handleNavigationClick}
                      />
                    ))}

                    {/* Loading indicator */}
                    {isLoading && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex gap-3 p-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-ocean flex items-center justify-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Sparkles className="w-4 h-4 text-white" />
                          </motion.div>
                        </div>
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
                          <div className="flex gap-1">
                            <motion.span
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                            />
                            <motion.span
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                            />
                            <motion.span
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                              className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <ChatInput onSend={sendMessage} isLoading={isLoading} isRTL={isRTL} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
