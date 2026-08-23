import { motion } from "framer-motion";
import { Bot, User, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { CourseCard } from "./CourseCard";

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

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  suggestedPath?: string | null;
  courses?: Course[];
  onNavigate?: (path: string) => void;
}

// Map paths to friendly names
const getPathLabel = (path: string, isRTL: boolean): string => {
  const pathLabels: Record<string, { ar: string; en: string }> = {
    '/courses': { ar: 'صفحة الدورات', en: 'Courses Page' },
    '/login': { ar: 'تسجيل الدخول', en: 'Login' },
    '/signup': { ar: 'إنشاء حساب', en: 'Sign Up' },
    '/dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
    '/dashboard?tab=request': { ar: 'طلب دورة خاصة', en: 'Request Custom Course' },
    '/dashboard?tab=certificates': { ar: 'الشهادات', en: 'Certificates' },
    '/dashboard?tab=courses': { ar: 'دوراتي', en: 'My Courses' },
    '/about': { ar: 'من نحن', en: 'About Us' },
  };
  
  // Check for course detail pages
  if (path.startsWith('/courses/')) {
    return isRTL ? 'صفحة الدورة' : 'Course Page';
  }
  
  const label = pathLabels[path];
  return label ? (isRTL ? label.ar : label.en) : (isRTL ? 'الانتقال' : 'Go');
};

export function ChatMessage({ role, content, isStreaming, suggestedPath, courses, onNavigate }: ChatMessageProps) {
  const isAssistant = role === "assistant";
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex gap-3 p-3",
        isAssistant ? "flex-row" : "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isAssistant
            ? "bg-gradient-ocean text-white"
            : "bg-primary text-primary-foreground"
        )}
      >
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      
      <div
        className={cn(
          "flex-1 max-w-[85%]",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            isAssistant
              ? "bg-muted text-foreground rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          )}
        >
          <div className="text-sm leading-relaxed">
            <MathMarkdown content={content} />
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
            )}
          </div>

        </div>
        
        {/* Course Cards */}
        {isAssistant && courses && courses.length > 0 && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-3 space-y-2"
          >
            {courses.slice(0, 3).map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isRTL={isRTL}
                onNavigate={onNavigate}
              />
            ))}
            {courses.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                {isRTL 
                  ? `و ${courses.length - 3} دورات أخرى...` 
                  : `And ${courses.length - 3} more courses...`}
              </p>
            )}
          </motion.div>
        )}
        
        {/* Navigation suggestion button */}
        {isAssistant && suggestedPath && onNavigate && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-2"
          >
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate(suggestedPath)}
              className="gap-2 text-xs bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary"
            >
              <ExternalLink className="h-3 w-3" />
              {isRTL ? `الانتقال إلى ${getPathLabel(suggestedPath, isRTL)}` : `Go to ${getPathLabel(suggestedPath, isRTL)}`}
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
