import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InstructorStudentsSkeleton } from '@/components/ui/skeletons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Users, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

interface Student {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  course_title: string;
  course_title_ar: string;
  course_id: string;
  progress: number;
  enrolled_at: string;
  status: string;
}

export const InstructorStudents = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [courses, setCourses] = useState<{ id: string; title: string; title_ar: string }[]>([]);

  const texts = {
    ar: {
      title: 'طلابي',
      searchPlaceholder: 'ابحث عن طالب...',
      allCourses: 'جميع الدورات',
      noStudents: 'لا يوجد طلاب مسجلين بعد',
      progress: 'التقدم',
      enrolledIn: 'مسجل في',
      status: {
        active: 'نشط',
        completed: 'مكتمل',
        expired: 'منتهي',
      },
    },
    en: {
      title: 'My Students',
      searchPlaceholder: 'Search for a student...',
      allCourses: 'All Courses',
      noStudents: 'No students enrolled yet',
      progress: 'Progress',
      enrolledIn: 'Enrolled in',
      status: {
        active: 'Active',
        completed: 'Completed',
        expired: 'Expired',
      },
    },
  };

  const t = texts[language];

  useEffect(() => {
    if (user) {
      fetchCourses();
      fetchStudents();
    }
  }, [user]);

  useEffect(() => {
    filterStudents();
  }, [searchQuery, selectedCourse, students]);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('id, title, title_ar')
      .eq('instructor_id', user?.id);
    setCourses(data || []);
  };

  const fetchStudents = async () => {
    try {
      // Get instructor's courses
      const { data: instructorCourses } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .eq('instructor_id', user?.id);

      if (!instructorCourses || instructorCourses.length === 0) {
        setLoading(false);
        return;
      }

      const courseIds = instructorCourses.map(c => c.id);

      // Get enrollments for these courses
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select('*')
        .in('course_id', courseIds);

      if (error) throw error;

      // Get student profiles
      const studentData: Student[] = [];
      for (const enrollment of enrollments || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', enrollment.user_id)
          .single();

        const course = instructorCourses.find(c => c.id === enrollment.course_id);

        if (profile && course) {
          studentData.push({
            id: enrollment.id,
            full_name: profile.full_name || profile.email || 'Unknown',
            email: profile.email || '',
            avatar_url: profile.avatar_url,
            course_title: course.title,
            course_title_ar: course.title_ar,
            course_id: course.id,
            progress: enrollment.progress || 0,
            enrolled_at: enrollment.enrolled_at || '',
            status: enrollment.status || 'active',
          });
        }
      }

      setStudents(studentData);
      setFilteredStudents(studentData);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = [...students];

    if (searchQuery) {
      filtered = filtered.filter(
        s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             s.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCourse !== 'all') {
      filtered = filtered.filter(s => s.course_id === selectedCourse);
    }

    setFilteredStudents(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">{t.status.active}</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800">{t.status.completed}</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">{t.status.expired}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <InstructorStudentsSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
            />
          </div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder={t.allCourses} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allCourses}</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {language === 'ar' ? course.title_ar : course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.noStudents}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStudents.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={student.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-gold text-primary-foreground">
                    {student.full_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{student.full_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {language === 'ar' ? student.course_title_ar : student.course_title}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(student.status)}
                  <div className="flex items-center gap-2 w-32">
                    <Progress value={student.progress} className="h-2" />
                    <span className="text-sm font-medium">{student.progress}%</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};