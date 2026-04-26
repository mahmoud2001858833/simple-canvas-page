import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, BookOpen, Lightbulb, ListChecks, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LessonAIAssistantProps {
  lessonId: string;
  lessonTitle: string;
  isRTL: boolean;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const QUICK_ACTIONS = [
  { id: "summarize", icon: BookOpen, labelAr: "لخصلي الدرس", labelEn: "Summarize" },
  { id: "explain", icon: Lightbulb, labelAr: "اشرحلي المفاهيم", labelEn: "Explain" },
  { id: "keypoints", icon: ListChecks, labelAr: "النقاط المهمة", labelEn: "Key Points" },
];

async function streamChat({
  lessonId,
  messages,
  action,
  onDelta,
  onDone,
  onError,
}: {
  lessonId: string;
  messages?: Message[];
  action?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { onError("Not authenticated"); return; }

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lesson-ai-chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ lessonId, messages, action }),
    }
  );

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({ error: "Unknown error" }));
    onError(errData.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) { onError("No response body"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export function LessonAIAssistant({ lessonId, lessonTitle, isRTL, externalOpen, onOpenChange }: LessonAIAssistantProps) {
  const isOpen = externalOpen ?? false;
  const setIsOpen = onOpenChange ?? (() => {});

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasTranscript, setHasTranscript] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Check if transcript exists
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const checkTranscript = async () => {
      const { data } = await supabase
        .from("lesson_transcripts")
        .select("status")
        .eq("lesson_id", lessonId)
        .maybeSingle();
      const status = data?.status;
      if (status === "completed") {
        setHasTranscript(true);
        if (interval) clearInterval(interval);
      } else if (status === "processing") {
        setHasTranscript(false);
        if (!interval) {
          interval = setInterval(checkTranscript, 5000);
        }
      } else {
        setHasTranscript(null);
      }
    };
    checkTranscript();
    return () => { if (interval) clearInterval(interval); };
  }, [lessonId]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input and scroll into view when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }, [isOpen]);

  const handleSend = useCallback(async (text?: string, action?: string) => {
    if (isLoading) return;
    const userText = text || input.trim();
    if (!userText && !action) return;

    const userMsg: Message = { role: "user", content: userText || (
      action === "summarize" ? "لخصلي الدرس" :
      action === "explain" ? "اشرحلي المفاهيم" :
      action === "keypoints" ? "النقاط المهمة" : ""
    )};
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      lessonId,
      messages: action ? undefined : newMessages,
      action,
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setIsLoading(false);
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${err}` }]);
      },
    });
  }, [input, messages, lessonId, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Quick Actions Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            onClick={() => { setIsOpen(true); handleSend(undefined, action.id); }}
            disabled={isLoading}
            className="gap-1.5 text-xs hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
          >
            <action.icon className="h-3.5 w-3.5 text-primary" />
            {isRTL ? action.labelAr : action.labelEn}
          </Button>
        ))}
        <Button
          variant={isOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-1.5 text-xs ms-auto transition-all duration-200"
        >
          <Bot className="h-3.5 w-3.5" />
          {isRTL ? "المساعد الذكي" : "AI Assistant"}
          {isOpen ? <X className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
        </Button>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3"
          >
            <div className="border rounded-xl bg-card shadow-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Bot className="h-5 w-5 text-primary" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold">{isRTL ? "المساعد الذكي" : "AI Assistant"}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{lessonTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {hasTranscript && (
                    <Badge variant="outline" className="text-[9px] text-green-600 border-green-200 px-1.5 py-0">
                      ✓ {isRTL ? "جاهز" : "Ready"}
                    </Badge>
                  )}
                  {hasTranscript === false && (
                    <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200 px-1.5 py-0">
                      ⏳ {isRTL ? "تجهيز" : "Loading"}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="h-[320px] overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center justify-center h-full text-center text-muted-foreground"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="h-10 w-10 mb-3 text-primary/30" />
                    </motion.div>
                    <p className="text-sm font-semibold">{isRTL ? "اسألني أي شيء عن الدرس!" : "Ask me anything about this lesson!"}</p>
                    <p className="text-xs mt-1.5 text-muted-foreground/70">{isRTL ? "أقدر ألخصلك، أشرحلك، أو أجاوب أسئلتك" : "I can summarize, explain, or answer questions"}</p>
                  </motion.div>
                )}
                {messages.map((msg, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1 me-2">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1 me-2">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <motion.div className="w-2 h-2 rounded-full bg-primary/40" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                        <motion.div className="w-2 h-2 rounded-full bg-primary/40" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                        <motion.div className="w-2 h-2 rounded-full bg-primary/40" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <div className="border-t p-3 bg-muted/30">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isRTL ? "اكتب سؤالك هنا..." : "Type your question..."}
                    rows={1}
                    className="flex-1 resize-none border rounded-xl px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[40px] max-h-[100px] transition-all duration-200"
                    disabled={isLoading}
                  />
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl"
                      onClick={() => handleSend()}
                      disabled={isLoading || !input.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
