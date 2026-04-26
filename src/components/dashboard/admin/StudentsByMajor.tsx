import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Users, GraduationCap, Building2, School, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const StudentsByMajor = () => {
  const { dir, language } = useLanguage();
  const isRTL = dir === 'rtl';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('all');
  const [selectedCollege, setSelectedCollege] = useState<string>('all');
  const [selectedMajor, setSelectedMajor] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'by-major' | 'by-university'>('by-major');

  // Fetch universities
  const { data: universities } = useQuery({
    queryKey: ['universities-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch colleges based on selected university
  const { data: colleges } = useQuery({
    queryKey: ['colleges-by-university', selectedUniversity],
    queryFn: async () => {
      let query = supabase
        .from('colleges')
        .select('*, universities(name, name_ar)')
        .eq('is_active', true)
        .order('name');
      
      if (selectedUniversity !== 'all') {
        query = query.eq('university_id', selectedUniversity);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch majors based on selected college
  const { data: majors } = useQuery({
    queryKey: ['majors-by-college', selectedCollege],
    queryFn: async () => {
      let query = supabase
        .from('majors')
        .select('*, colleges(name, name_ar, university_id, universities(name, name_ar))')
        .eq('is_active', true)
        .order('name');
      
      if (selectedCollege !== 'all') {
        query = query.eq('college_id', selectedCollege);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch students with their university and major info
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-by-filters', selectedUniversity, selectedMajor, searchQuery],
    queryFn: async () => {
      // Get student user_ids
      const { data: studentRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      
      if (rolesError) throw rolesError;
      
      const studentIds = studentRoles?.map(r => r.user_id) || [];
      
      if (studentIds.length === 0) return [];
      
      let query = supabase
        .from('profiles')
        .select(`
          *,
          universities(id, name, name_ar),
          majors(id, name, name_ar, college_id, colleges(name, name_ar, university_id))
        `)
        .in('id', studentIds);
      
      if (selectedUniversity !== 'all') {
        query = query.eq('university_id', selectedUniversity);
      }
      
      if (selectedMajor !== 'all') {
        query = query.eq('major_id', selectedMajor);
      }
      
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group students by major
  const studentsByMajor = majors?.map(major => ({
    major,
    students: students?.filter(s => s.major_id === major.id) || [],
  })).filter(group => group.students.length > 0) || [];

  // Group students by university
  const studentsByUniversity = universities?.map(uni => ({
    university: uni,
    students: students?.filter(s => s.university_id === uni.id) || [],
  })).filter(group => group.students.length > 0) || [];

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            {isRTL ? 'الطلاب حسب التخصص والجامعة' : 'Students by Major & University'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRTL ? 'عرض الطلاب المسجلين حسب التخصص أو الجامعة' : 'View enrolled students by major or university'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="w-4 h-4" />
            {students?.length || 0} {isRTL ? 'طالب' : 'students'}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {isRTL ? 'الفلترة والبحث' : 'Filter & Search'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'بحث عن طالب...' : 'Search students...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9"
              />
            </div>

            {/* University Filter */}
            <Select value={selectedUniversity} onValueChange={(val) => {
              setSelectedUniversity(val);
              setSelectedCollege('all');
              setSelectedMajor('all');
            }}>
              <SelectTrigger>
                <Building2 className="w-4 h-4 me-2 text-muted-foreground" />
                <SelectValue placeholder={isRTL ? 'الجامعة' : 'University'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'كل الجامعات' : 'All Universities'}</SelectItem>
                {universities?.map((uni) => (
                  <SelectItem key={uni.id} value={uni.id}>
                    {isRTL ? uni.name_ar : uni.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* College Filter */}
            <Select value={selectedCollege} onValueChange={(val) => {
              setSelectedCollege(val);
              setSelectedMajor('all');
            }}>
              <SelectTrigger>
                <School className="w-4 h-4 me-2 text-muted-foreground" />
                <SelectValue placeholder={isRTL ? 'الكلية' : 'College'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'كل الكليات' : 'All Colleges'}</SelectItem>
                {colleges?.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {isRTL ? col.name_ar : col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Major Filter */}
            <Select value={selectedMajor} onValueChange={setSelectedMajor}>
              <SelectTrigger>
                <GraduationCap className="w-4 h-4 me-2 text-muted-foreground" />
                <SelectValue placeholder={isRTL ? 'التخصص' : 'Major'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'كل التخصصات' : 'All Majors'}</SelectItem>
                {majors?.map((major) => (
                  <SelectItem key={major.id} value={major.id}>
                    {isRTL ? major.name_ar : major.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="by-major" className="gap-2">
            <GraduationCap className="w-4 h-4" />
            {isRTL ? 'حسب التخصص' : 'By Major'}
          </TabsTrigger>
          <TabsTrigger value="by-university" className="gap-2">
            <Building2 className="w-4 h-4" />
            {isRTL ? 'حسب الجامعة' : 'By University'}
          </TabsTrigger>
        </TabsList>

        {/* By Major Tab */}
        <TabsContent value="by-major" className="space-y-4 mt-4">
          {studentsLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </CardContent>
            </Card>
          ) : studentsByMajor.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {isRTL ? 'لا يوجد طلاب مسجلين' : 'No students found'}
              </CardContent>
            </Card>
          ) : (
            studentsByMajor.map(({ major, students: majorStudents }) => (
              <Card key={major.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary" />
                      {isRTL ? major.name_ar : major.name}
                    </div>
                    <Badge>{majorStudents.length} {isRTL ? 'طالب' : 'students'}</Badge>
                  </CardTitle>
                  {major.colleges && (
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? major.colleges.name_ar : major.colleges.name}
                      {major.colleges.universities && (
                        <> - {isRTL ? major.colleges.universities.name_ar : major.colleges.universities.name}</>
                      )}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead>{isRTL ? 'البريد الإلكتروني' : 'Email'}</TableHead>
                        <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                        <TableHead>{isRTL ? 'تاريخ التسجيل' : 'Joined'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {majorStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={student.avatar_url || ''} />
                                <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{student.full_name || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{student.email || '-'}</TableCell>
                          <TableCell>{student.phone || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {student.created_at ? new Date(student.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* By University Tab */}
        <TabsContent value="by-university" className="space-y-4 mt-4">
          {studentsLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </CardContent>
            </Card>
          ) : studentsByUniversity.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {isRTL ? 'لا يوجد طلاب مسجلين' : 'No students found'}
              </CardContent>
            </Card>
          ) : (
            studentsByUniversity.map(({ university, students: uniStudents }) => (
              <Card key={university.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      {isRTL ? university.name_ar : university.name}
                    </div>
                    <Badge>{uniStudents.length} {isRTL ? 'طالب' : 'students'}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead>{isRTL ? 'البريد الإلكتروني' : 'Email'}</TableHead>
                        <TableHead>{isRTL ? 'التخصص' : 'Major'}</TableHead>
                        <TableHead>{isRTL ? 'تاريخ التسجيل' : 'Joined'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uniStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={student.avatar_url || ''} />
                                <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{student.full_name || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{student.email || '-'}</TableCell>
                          <TableCell>
                            {student.majors ? (isRTL ? student.majors.name_ar : student.majors.name) : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {student.created_at ? new Date(student.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsByMajor;
