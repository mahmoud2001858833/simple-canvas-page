import { motion } from "framer-motion";
import { Clock, Users, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course: {
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
  };
  isRTL: boolean;
  onNavigate?: (path: string) => void;
}

export function CourseCard({ course, isRTL, onNavigate }: CourseCardProps) {
  const title = isRTL ? course.title_ar : course.title;
  const description = isRTL ? course.description_ar : course.description;
  const hasDiscount = course.original_price && course.original_price > (course.price || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Thumbnail */}
      <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-primary/40" />
          </div>
        )}
        
        {/* Category Badge */}
        {course.category && (
          <Badge className="absolute top-2 start-2 bg-primary/90 text-primary-foreground text-xs">
            {course.category}
          </Badge>
        )}
        
        {/* Discount Badge */}
        {hasDiscount && (
          <Badge className="absolute top-2 end-2 bg-destructive text-destructive-foreground text-xs">
            {isRTL ? "خصم" : "Sale"}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h4 className="font-semibold text-sm line-clamp-2 mb-1">
          {title}
        </h4>
        
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {description}
          </p>
        )}
        
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          {course.duration_hours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {course.duration_hours} {isRTL ? "ساعة" : "hrs"}
            </span>
          )}
        </div>
        
        {/* Price and Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary text-sm">
              {course.price || 0} {isRTL ? "ر.س" : "SAR"}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {course.original_price} {isRTL ? "ر.س" : "SAR"}
              </span>
            )}
          </div>
          
          {onNavigate && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onNavigate(`/courses/${course.id}`)}
            >
              {isRTL ? "التفاصيل" : "Details"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
