import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  isRTL: boolean;
}

export function ChatInput({ onSend, isLoading, isRTL }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 border-t border-border bg-background/50">
      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRTL ? "اكتب رسالتك هنا..." : "Type your message..."}
          disabled={isLoading}
          className={cn(
            "min-h-[44px] max-h-[120px] resize-none text-sm",
            isRTL && "text-right"
          )}
          dir={isRTL ? "rtl" : "ltr"}
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 flex-shrink-0"
        >
          <Send className={cn("h-4 w-4", isRTL && "rotate-180")} />
        </Button>
      </div>
    </div>
  );
}
