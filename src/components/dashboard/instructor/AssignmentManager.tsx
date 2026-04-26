import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, FileText, Download, CheckCircle, Users } from 'lucide-react';

export const AssignmentManager = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isAr = language === 'ar';
  const [createDialog, setCreateDialog] = useState(false);
  const [gradeDialog, setGradeDialog] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [form, setForm] = useState({ title: '', title_ar: '', description: '', description_ar: '', max_score: 100, deadline: '' });
  const [gradeForm, setGradeForm] = useState({ score: 0, feedback: '', feedback_ar: '' });

  // Get instructor's courses
  const { data: courses } = useQuery({
    queryKey: ['instructor-courses-for-assignments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title, title_ar').eq('instructor_id', user!.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Get chapters for selected course
  const { data: chapters } = useQuery({
    queryKey: ['chapters-for-assignment', selectedCourse],
    queryFn: async () => {
      const { data } = await supabase.from('chapters').select('id, title, title_ar').eq('course_id', selectedCourse).order('sort_order');
      return data || [];
    },
    enabled: !!selectedCourse,
  });

  // Get assignments for instructor's courses
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['instructor-assignments', user?.id],
    queryFn: async () => {
      const courseIds = courses?.map(c => c.id) || [];
      if (!courseIds.length) return [];
      const { data, error } = await supabase
        .from('assignments')
        .select(`*, courses(title, title_ar), chapters(title, title_ar)`)
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!courses?.length,
  });

  // Get submissions for a specific assignment
  const { data: submissions } = useQuery({
    queryKey: ['assignment-submissions', gradeDialog?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*, profiles:user_id(full_name, full_name_ar, email)')
        .eq('assignment_id', gradeDialog.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradeDialog?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assignments').insert({
        course_id: selectedCourse,
        chapter_id: selectedChapter,
        title: form.title,
        title_ar: form.title_ar,
        description: form.description || null,
        description_ar: form.description_ar || null,
        max_score: form.max_score,
        deadline: form.deadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-assignments'] });
      toast.success(isAr ? 'تم إنشاء الواجب بنجاح' : 'Assignment created');
      setCreateDialog(false);
      setForm({ title: '', title_ar: '', description: '', description_ar: '', max_score: 100, deadline: '' });
    },
    onError: () => toast.error(isAr ? 'حدث خطأ' : 'Failed to create'),
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ submissionId }: { submissionId: string }) => {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          score: gradeForm.score,
          feedback: gradeForm.feedback || null,
          feedback_ar: gradeForm.feedback_ar || null,
          status: 'graded',
          graded_at: new Date().toISOString(),
        })
        .eq('id', submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions'] });
      toast.success(isAr ? 'تم التقييم بنجاح' : 'Graded successfully');
      setGradeForm({ score: 0, feedback: '', feedback_ar: '' });
    },
    onError: () => toast.error(isAr ? 'حدث خطأ' : 'Grading failed'),
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{isAr ? 'إدارة الواجبات' : 'Assignments'}</h2>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="w-4 h-4 me-2" />
          {isAr ? 'واجب جديد' : 'New Assignment'}
        </Button>
      </div>

      {!assignments?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p>{isAr ? 'لا توجد واجبات' : 'No assignments yet'}</p>
          </CardContent>
        </Card>
      ) : (
        assignments.map((assignment: any) => (
          <Card key={assignment.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{isAr ? assignment.title_ar : assignment.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isAr ? (assignment.courses as any)?.title_ar : (assignment.courses as any)?.title}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setGradeDialog(assignment)}>
                  <Users className="w-4 h-4 me-2" />
                  {isAr ? 'عرض التسليمات' : 'View Submissions'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{isAr ? `الدرجة: ${assignment.max_score}` : `Max: ${assignment.max_score}`}</span>
                {assignment.deadline && (
                  <span>{format(new Date(assignment.deadline), 'PPp', { locale: isAr ? ar : undefined })}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAr ? 'إنشاء واجب جديد' : 'Create Assignment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedCourse} onValueChange={v => { setSelectedCourse(v); setSelectedChapter(''); }}>
              <SelectTrigger><SelectValue placeholder={isAr ? 'اختر الكورس' : 'Select Course'} /></SelectTrigger>
              <SelectContent>
                {courses?.map(c => <SelectItem key={c.id} value={c.id}>{isAr ? c.title_ar : c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedCourse && (
              <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                <SelectTrigger><SelectValue placeholder={isAr ? 'اختر الفصل' : 'Select Chapter'} /></SelectTrigger>
                <SelectContent>
                  {chapters?.map(c => <SelectItem key={c.id} value={c.id}>{isAr ? c.title_ar : c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input placeholder={isAr ? 'عنوان الواجب (عربي)' : 'Title (Arabic)'} value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} />
            <Input placeholder={isAr ? 'عنوان الواجب (إنجليزي)' : 'Title (English)'} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder={isAr ? 'الوصف (عربي)' : 'Description (Arabic)'} value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} rows={2} />
            <Textarea placeholder={isAr ? 'الوصف (إنجليزي)' : 'Description (English)'} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="flex gap-4">
              <Input type="number" placeholder={isAr ? 'الدرجة القصوى' : 'Max Score'} value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: Number(e.target.value) }))} />
              <Input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!selectedCourse || !selectedChapter || !form.title_ar || createMutation.isPending}>
              {createMutation.isPending ? '...' : (isAr ? 'إنشاء' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions & Grading Dialog */}
      <Dialog open={!!gradeDialog} onOpenChange={() => setGradeDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAr ? 'التسليمات' : 'Submissions'}</DialogTitle>
          </DialogHeader>
          {!submissions?.length ? (
            <p className="text-muted-foreground text-center py-8">{isAr ? 'لا توجد تسليمات' : 'No submissions yet'}</p>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub: any) => (
                <Card key={sub.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{isAr ? (sub.profiles as any)?.full_name_ar : (sub.profiles as any)?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sub.submitted_at), 'PPp', { locale: isAr ? ar : undefined })}
                        </p>
                      </div>
                      <Badge variant={sub.status === 'graded' ? 'default' : 'secondary'}>
                        {sub.status === 'graded' ? `${sub.score}/${gradeDialog?.max_score}` : (isAr ? 'بانتظار التقييم' : 'Pending')}
                      </Badge>
                    </div>
                    {sub.file_url && (
                      <a href={sub.file_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <Download className="w-4 h-4" /> {sub.file_name || (isAr ? 'تحميل الملف' : 'Download')}
                      </a>
                    )}
                    {sub.notes && <p className="text-sm text-muted-foreground">{sub.notes}</p>}
                    {sub.status !== 'graded' && (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input type="number" placeholder={isAr ? 'الدرجة' : 'Score'} min={0} max={gradeDialog?.max_score}
                            onChange={e => setGradeForm(f => ({ ...f, score: Number(e.target.value) }))} />
                        </div>
                        <div className="flex-[2]">
                          <Input placeholder={isAr ? 'تغذية راجعة' : 'Feedback'}
                            onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value, feedback_ar: e.target.value }))} />
                        </div>
                        <Button size="sm" onClick={() => gradeMutation.mutate({ submissionId: sub.id })} disabled={gradeMutation.isPending}>
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
