import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User, ImagePlus, X, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { MathMarkdown } from "@/components/ai/MathMarkdown";

type Message = { role: 'user' | 'assistant'; content: string; image?: string };

export const InstructorAIChat = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة فقط' : 'Please select an image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 10 ميجابايت' : 'Image must be less than 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageBase64(result.split(',')[1]);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageBase64(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed && !imageBase64) return;

    const userMsg: Message = { role: 'user', content: trimmed, image: imagePreview || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const sentImage = imageBase64;
    removeImage();

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instructor-ai-chat`;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages.filter(m => !m.image).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: trimmed }],
          image: sentImage || undefined,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) { toast.error(language === 'ar' ? 'تم تجاوز الحد، حاول لاحقاً' : 'Rate limit exceeded'); setIsLoading(false); return; }
        if (resp.status === 402) { toast.error(language === 'ar' ? 'رصيد غير كافٍ' : 'Insufficient credits'); setIsLoading(false); return; }
        throw new Error('Failed');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || !line.trim()) continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(language === 'ar' ? 'حدث خطأ في المساعد الذكي' : 'AI assistant error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="h-[calc(100vh-8rem)] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'مساعدك الذكي' : 'Your AI Assistant'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'اسألني أي سؤال تعليمي أو تقني، ويمكنك رفع صور للتحليل' : 'Ask any educational or technical question, you can also upload images'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
              <Bot className="w-12 h-12 opacity-50" />
              <p className="text-lg font-medium">{language === 'ar' ? 'مرحباً! كيف يمكنني مساعدتك؟' : 'Hello! How can I help you?'}</p>
              <p className="text-sm max-w-md">
                {language === 'ar' ? 'يمكنك سؤالي عن أي شيء يتعلق بالتعليم أو المحتوى أو التقنية. يمكنك أيضاً رفع صورة للتحليل.' : 'Ask me about education, content, or technology. You can also upload images for analysis.'}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {msg.image && (
                  <img src={msg.image} alt="uploaded" className="max-w-48 rounded-lg mb-2" />
                )}
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MathMarkdown content={msg.content} />
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="px-4 py-2 border-t">
            <div className="relative inline-block">
              <img src={imagePreview} alt="preview" className="h-16 rounded-lg" />
              <button onClick={removeImage} className="absolute -top-2 -end-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t flex gap-2 items-end">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <Button type="button" variant="outline" size="icon" className="flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            <ImagePlus className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={language === 'ar' ? 'اكتب سؤالك هنا...' : 'Type your question...'}
            className="min-h-[44px] max-h-32 resize-none"
            dir={dir}
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || (!input.trim() && !imageBase64)} size="icon" className="flex-shrink-0">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
