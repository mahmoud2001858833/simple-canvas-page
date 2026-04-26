import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, GraduationCap, BookOpen, DollarSign, Award, Clock, Search, TrendingUp } from 'lucide-react';

interface InstructorData {
  id: string;
  full_name: string;
  email: string;
  courses_count: number;
  students_count: number;
  paid_earnings: number;
  pending_earnings: number;
  total_earnings: number;
  last_activity: string | null;
}

interface StudentData {
  id: string;
  full_name: string;
  email: string;
  courses_count: number;
  certificates_count: number;
  total_paid: number;
  average_progress: number;
  last_activity: string | null;
}

export const UserInsights = () => {
  const { dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const [instructorSearch, setInstructorSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Fetch instructors data
  const { data: instructors, isLoading: instructorsLoading } = useQuery({
    queryKey: ['admin-instructor-insights'],
    queryFn: async () => {
      // Get all instructors
      const { data: instructorRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');

      if (rolesError) throw rolesError;
      if (!instructorRoles || instructorRoles.length === 0) return [];

      const instructorIds = instructorRoles.map(r => r.user_id);

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, updated_at')
        .in('id', instructorIds);

      if (profilesError) throw profilesError;

      // Get courses for each instructor
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, instructor_id')
        .in('instructor_id', instructorIds);

      if (coursesError) throw coursesError;

      // Get enrollments for instructor courses
      const courseIds = courses?.map(c => c.id) || [];
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('course_id, user_id')
        .in('course_id', courseIds);

      if (enrollmentsError) throw enrollmentsError;

      // Get instructor earnings
      const { data: earnings, error: earningsError } = await supabase
        .from('instructor_earnings')
        .select('instructor_id, amount, status')
        .in('instructor_id', instructorIds);

      if (earningsError) throw earningsError;

      // Process data
      const instructorData: InstructorData[] = profiles?.map(profile => {
        const instructorCourses = courses?.filter(c => c.instructor_id === profile.id) || [];
        const instructorCourseIds = instructorCourses.map(c => c.id);
        const instructorEnrollments = enrollments?.filter(e => instructorCourseIds.includes(e.course_id)) || [];
        const uniqueStudents = new Set(instructorEnrollments.map(e => e.user_id));
        
        const instructorEarnings = earnings?.filter(e => e.instructor_id === profile.id) || [];
        const paidEarnings = instructorEarnings.filter(e => e.status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0);
        const pendingEarnings = instructorEarnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0);

        return {
          id: profile.id,
          full_name: profile.full_name || 'غير محدد',
          email: profile.email || '',
          courses_count: instructorCourses.length,
          students_count: uniqueStudents.size,
          paid_earnings: paidEarnings,
          pending_earnings: pendingEarnings,
          total_earnings: paidEarnings + pendingEarnings,
          last_activity: profile.updated_at
        };
      }) || [];

      return instructorData;
    }
  });

  // Fetch students data
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['admin-student-insights'],
    queryFn: async () => {
      // Get all students
      const { data: studentRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (rolesError) throw rolesError;
      if (!studentRoles || studentRoles.length === 0) return [];

      const studentIds = studentRoles.map(r => r.user_id);

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, updated_at')
        .in('id', studentIds);

      if (profilesError) throw profilesError;

      // Get enrollments
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('user_id, progress')
        .in('user_id', studentIds);

      if (enrollmentsError) throw enrollmentsError;

      // Get certificates
      const { data: certificates, error: certificatesError } = await supabase
        .from('certificates')
        .select('user_id')
        .in('user_id', studentIds);

      if (certificatesError) throw certificatesError;

      // Get payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('user_id, amount, status')
        .in('user_id', studentIds)
        .eq('status', 'paid');

      if (paymentsError) throw paymentsError;

      // Process data
      const studentData: StudentData[] = profiles?.map(profile => {
        const studentEnrollments = enrollments?.filter(e => e.user_id === profile.id) || [];
        const studentCertificates = certificates?.filter(c => c.user_id === profile.id) || [];
        const studentPayments = payments?.filter(p => p.user_id === profile.id) || [];
        
        const avgProgress = studentEnrollments.length > 0 
          ? studentEnrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / studentEnrollments.length 
          : 0;

        return {
          id: profile.id,
          full_name: profile.full_name || 'غير محدد',
          email: profile.email || '',
          courses_count: studentEnrollments.length,
          certificates_count: studentCertificates.length,
          total_paid: studentPayments.reduce((sum, p) => sum + Number(p.amount), 0),
          average_progress: Math.round(avgProgress),
          last_activity: profile.updated_at
        };
      }) || [];

      return studentData;
    }
  });

  // Filter functions
  const filteredInstructors = instructors?.filter(i => 
    i.full_name?.toLowerCase().includes(instructorSearch.toLowerCase()) ||
    i.email?.toLowerCase().includes(instructorSearch.toLowerCase())
  ) || [];

  const filteredStudents = students?.filter(s => 
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(studentSearch.toLowerCase())
  ) || [];

  // Stats calculations
  const instructorStats = {
    total: instructors?.length || 0,
    totalCourses: instructors?.reduce((sum, i) => sum + i.courses_count, 0) || 0,
    totalStudents: instructors?.reduce((sum, i) => sum + i.students_count, 0) || 0,
    totalEarnings: instructors?.reduce((sum, i) => sum + i.total_earnings, 0) || 0
  };

  const studentStats = {
    total: students?.length || 0,
    totalEnrollments: students?.reduce((sum, s) => sum + s.courses_count, 0) || 0,
    totalCertificates: students?.reduce((sum, s) => sum + s.certificates_count, 0) || 0,
    totalPaid: students?.reduce((sum, s) => sum + s.total_paid, 0) || 0
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return isRTL ? 'غير محدد' : 'N/A';
    return new Date(date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{isRTL ? 'معلومات المستخدمين' : 'User Insights'}</h1>
        <p className="text-muted-foreground mt-2">
          {isRTL ? 'عرض تفصيلي لمعلومات المعلمين والطلاب' : 'Detailed view of instructors and students information'}
        </p>
      </div>

      <Tabs defaultValue="instructors" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="instructors" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            {isRTL ? 'المعلمين' : 'Instructors'}
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {isRTL ? 'الطلاب' : 'Students'}
          </TabsTrigger>
        </TabsList>

        {/* Instructors Tab */}
        <TabsContent value="instructors" className="space-y-6">
          {/* Instructor Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <GraduationCap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي المعلمين' : 'Total Instructors'}</p>
                    <p className="text-2xl font-bold">{instructorStats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <BookOpen className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الكورسات' : 'Total Courses'}</p>
                    <p className="text-2xl font-bold">{instructorStats.totalCourses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 rounded-full">
                    <Users className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الطلاب' : 'Total Students'}</p>
                    <p className="text-2xl font-bold">{instructorStats.totalStudents}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-full">
                    <DollarSign className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الأرباح' : 'Total Earnings'}</p>
                    <p className="text-2xl font-bold">{formatCurrency(instructorStats.totalEarnings)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'بحث عن معلم...' : 'Search instructor...'}
              value={instructorSearch}
              onChange={(e) => setInstructorSearch(e.target.value)}
              className="ps-10"
            />
          </div>

          {/* Instructors Table */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'قائمة المعلمين' : 'Instructors List'}</CardTitle>
            </CardHeader>
            <CardContent>
              {instructorsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الكورسات' : 'Courses'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'أرباح مدفوعة' : 'Paid'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'أرباح معلقة' : 'Pending'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                        <TableHead>{isRTL ? 'آخر نشاط' : 'Last Activity'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInstructors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            {isRTL ? 'لا يوجد معلمين' : 'No instructors found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInstructors.map((instructor) => (
                          <TableRow key={instructor.id}>
                            <TableCell className="font-medium">{instructor.full_name}</TableCell>
                            <TableCell className="text-muted-foreground">{instructor.email}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{instructor.courses_count}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{instructor.students_count}</Badge>
                            </TableCell>
                            <TableCell className="text-center text-green-600">
                              {formatCurrency(instructor.paid_earnings)}
                            </TableCell>
                            <TableCell className="text-center text-amber-600">
                              {formatCurrency(instructor.pending_earnings)}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {formatCurrency(instructor.total_earnings)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(instructor.last_activity)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6">
          {/* Student Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الطلاب' : 'Total Students'}</p>
                    <p className="text-2xl font-bold">{studentStats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <BookOpen className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي التسجيلات' : 'Total Enrollments'}</p>
                    <p className="text-2xl font-bold">{studentStats.totalEnrollments}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 rounded-full">
                    <Award className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الشهادات' : 'Total Certificates'}</p>
                    <p className="text-2xl font-bold">{studentStats.totalCertificates}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-full">
                    <DollarSign className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي المدفوعات' : 'Total Paid'}</p>
                    <p className="text-2xl font-bold">{formatCurrency(studentStats.totalPaid)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'بحث عن طالب...' : 'Search student...'}
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="ps-10"
            />
          </div>

          {/* Students Table */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'قائمة الطلاب' : 'Students List'}</CardTitle>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                        <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الكورسات' : 'Courses'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الشهادات' : 'Certificates'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'المدفوعات' : 'Payments'}</TableHead>
                        <TableHead>{isRTL ? 'آخر نشاط' : 'Last Activity'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            {isRTL ? 'لا يوجد طلاب' : 'No students found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.full_name}</TableCell>
                            <TableCell className="text-muted-foreground">{student.email}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{student.courses_count}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${student.average_progress}%` }}
                                  />
                                </div>
                                <span className="text-sm">{student.average_progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {student.certificates_count}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {formatCurrency(student.total_paid)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(student.last_activity)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
