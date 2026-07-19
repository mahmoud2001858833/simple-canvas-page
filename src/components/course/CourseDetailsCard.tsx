import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  GraduationCap, BookOpen, Video, Clock, FileText, 
  Calendar, FolderOpen, Building2, School 
} from 'lucide-react';

interface CourseDetailsCardProps {
  course: any;
  lessons: any[];
  chaptersCount: number;
  attachmentsCount: number;
  totalDuration: number;
}

export const CourseDetailsCard = ({
  course,
  lessons,
  chaptersCount,
  attachmentsCount,
  totalDuration,
}: CourseDetailsCardProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const details = [
    ...(course.majors?.colleges?.universities ? [{
      icon: Building2,
      label: isRTL ? 'الجهة' : 'University',
      value: isRTL ? course.majors.colleges.universities.name_ar : course.majors.colleges.universities.name,
    }] : []),
    ...(course.majors?.colleges ? [{
      icon: School,
      label: isRTL ? 'الكلية' : 'College',
      value: isRTL ? course.majors.colleges.name_ar : course.majors.colleges.name,
    }] : []),
    ...(course.majors ? [{
      icon: GraduationCap,
      label: isRTL ? 'التخصص' : 'Major',
      value: isRTL ? course.majors.name_ar : course.majors.name,
    }] : []),
    ...(course.study_year ? [{
      icon: Calendar,
      label: isRTL ? 'السنة الدراسية' : 'Study Year',
      value: course.study_year,
    }] : []),
  ];

  const stats = [
    { icon: FolderOpen, label: isRTL ? 'الفصول' : 'Chapters', value: chaptersCount },
    { icon: BookOpen, label: isRTL ? 'الدروس' : 'Lessons', value: lessons.length },
    { icon: Video, label: isRTL ? 'إجمالي المدة' : 'Total Duration', value: `${totalDuration} ${isRTL ? 'دقيقة' : 'min'}` },
    { icon: FileText, label: isRTL ? 'ملفات مرفقة' : 'Attachments', value: attachmentsCount },
    { icon: Clock, label: isRTL ? 'آخر تحديث' : 'Last Updated', value: course.updated_at ? new Date(course.updated_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {isRTL ? 'تفاصيل الدورة' : 'Course Details'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {details.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium truncate">{item.value}</p>
            </div>
          </div>
        ))}

        {details.length > 0 && <Separator />}

        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-muted/50">
              <stat.icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
