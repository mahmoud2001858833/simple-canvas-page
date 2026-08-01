import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Edit2, BookOpen, Users, DollarSign, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

export const InstructorSpecialties = () => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [search, setSearch] = useState('');
  const [editingInstructor, setEditingInstructor] = useState<any>(null);
  const [newSpecialty, setNewSpecialty] = useState('');

  // Fetch instructors with role = instructor
  const { data: instructors, isLoading, refetch } = useQuery({
    queryKey: ['instructor-specialties'],
    queryFn: async () => {
      // Get instructor user_ids
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');

      if (rolesError) {
        console.error('Error fetching instructor roles:', rolesError);
        throw rolesError;
      }

      if (!roles?.length) return [];

      const instructorIds = roles.map(r => r.user_id);

      // Fetch all data in parallel
      const [profilesRes, coursesRes, enrollmentsRes, earningsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .in('id', instructorIds),
        supabase
          .from('courses')
          .select('id, instructor_id'),
        supabase
          .from('enrollments')
          .select('id, course_id')
          .eq('status', 'active'),
        supabase
          .from('instructor_earnings')
          .select('instructor_id, amount'),
      ]);

      const profiles = profilesRes.data || [];
      const courses = coursesRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const earnings = earningsRes.data || [];

      // Aggregate
      return profiles.map(p => {
        const instructorCourses = courses.filter(c => c.instructor_id === p.id);
        const courseIds = instructorCourses.map(c => c.id);
        const studentCount = enrollments.filter(e => courseIds.includes(e.course_id)).length;
        const totalEarnings = earnings.filter(e => e.instructor_id === p.id).reduce((sum, e) => sum + Number(e.amount), 0);

        return {
          ...p,
          courseCount: instructorCourses.length,
          studentCount,
          totalEarnings,
        };
      });
    },
  });

  const filtered = instructors?.filter(i => {
    const q = search.toLowerCase();
    return !q || 
      i.full_name?.toLowerCase().includes(q) ||
      i.full_name_ar?.toLowerCase().includes(q) ||
      i.email?.toLowerCase().includes(q) ||
      i.specialty?.toLowerCase().includes(q);
  });

  const handleSaveSpecialty = async () => {
    if (!editingInstructor) return;
    const { error } = await supabase
      .from('profiles')
      .update({ specialty: newSpecialty.trim() || null } as any)
      .eq('id', editingInstructor.id);

    if (error) {
      toast.error(language === 'ar' ? 'فشل في التحديث' : 'Failed to update');
    } else {
      toast.success(language === 'ar' ? 'تم التحديث بنجاح' : 'Updated successfully');
      setEditingInstructor(null);
      refetch();
    }
  };

  // Summary stats
  const totalInstructors = instructors?.length || 0;
  const withSpecialty = instructors?.filter(i => i.specialty)?.length || 0;
  const totalCourses = instructors?.reduce((s, i) => s + i.courseCount, 0) || 0;
  const totalStudents = instructors?.reduce((s, i) => s + i.studentCount, 0) || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">
        {language === 'ar' ? 'تخصصات المعلمين والإنتاجية' : 'Instructor Specialties & Productivity'}
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalInstructors}</p>
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'معلم' : 'Instructors'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10"><GraduationCap className="w-5 h-5 text-secondary" /></div>
            <div>
              <p className="text-2xl font-bold">{withSpecialty}</p>
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'لديهم تخصص' : 'With Specialty'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><BookOpen className="w-5 h-5 text-accent-foreground" /></div>
            <div>
              <p className="text-2xl font-bold">{totalCourses}</p>
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'دورة' : 'Courses'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'طالب مسجل' : 'Enrolled Students'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={language === 'ar' ? 'بحث بالاسم أو التخصص...' : 'Search by name or specialty...'}
          className="ps-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'المعلم' : 'Instructor'}</TableHead>
                <TableHead>{language === 'ar' ? 'التخصص' : 'Specialty'}</TableHead>
                <TableHead>{language === 'ar' ? 'الدورات' : 'Courses'}</TableHead>
                <TableHead>{language === 'ar' ? 'الطلاب' : 'Students'}</TableHead>
                <TableHead>{language === 'ar' ? 'الأرباح' : 'Earnings'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراء' : 'Action'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</TableCell></TableRow>
              ) : !filtered?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{language === 'ar' ? 'لا توجد نتائج' : 'No results'}</TableCell></TableRow>
              ) : filtered.map(instructor => (
                <TableRow key={instructor.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{language === 'ar' ? instructor.full_name_ar || instructor.full_name : instructor.full_name}</p>
                      <p className="text-xs text-muted-foreground">{instructor.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {instructor.specialty ? (
                      <Badge variant="secondary">{instructor.specialty}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{language === 'ar' ? 'غير محدد' : 'Not set'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{instructor.courseCount}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{instructor.studentCount}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{instructor.totalEarnings.toFixed(0)} {language === 'ar' ? 'ر.س' : 'SAR'}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingInstructor(instructor);
                        setNewSpecialty(instructor.specialty || '');
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingInstructor} onOpenChange={() => setEditingInstructor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعديل التخصص' : 'Edit Specialty'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? editingInstructor?.full_name_ar || editingInstructor?.full_name : editingInstructor?.full_name}
            </p>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'التخصص' : 'Specialty'}</Label>
              <Input
                value={newSpecialty}
                onChange={e => setNewSpecialty(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل التخصص' : 'Enter specialty'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInstructor(null)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveSpecialty}>
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
