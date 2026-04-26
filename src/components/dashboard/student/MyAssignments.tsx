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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { FileText, Upload, Clock, CheckCircle, AlertCircle, Send } from 'lucide-react';

export const MyAssignments = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isAr = language === 'ar';
  const [submitDialog, setSubmitDialog] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  // Get enrolled course IDs
  const { data: enrolledCourseIds } = useQuery({
    queryKey: ['enrolled-course-ids', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user!.id)
        .eq('status', 'active');
      return data?.map(e => e.course_id) || [];
    },
    enabled: !!user?.id,
  });

  // Get assignments for enrolled courses
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['my-assignments', enrolledCourseIds],
    queryFn: async () => {
      if (!enrolledCourseIds?.length) return [];
      const { data, error } = await supabase
        .from('assignments')
        .select(`*, courses(title, title_ar), chapters(title, title_ar)`)
        .in('course_id', enrolledCourseIds)
        .eq('is_active', true)
        .order('deadline', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!enrolledCourseIds?.length,
  });

  // Get my submissions
  const { data: submissions } = useQuery({
    queryKey: ['my-submissions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${user!.id}/${assignmentId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('assignment-files')
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('assignment-files')
          .getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = file.name;
        fileType = file.type;
      }

      const { error } = await supabase.from('assignment_submissions').insert({
        assignment_id: assignmentId,
        user_id: user!.id,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        notes,
        status: 'submitted',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
      toast.success(isAr ? 'تم تسليم الواجب بنجاح' : 'Assignment submitted successfully');
      setSubmitDialog(null);
      setFile(null);
      setNotes('');
    },
    onError: () => {
      toast.error(isAr ? 'حدث خطأ أثناء التسليم' : 'Failed to submit assignment');
    },
  });

  const getSubmission = (assignmentId: string) =>
    submissions?.find(s => s.assignment_id === assignmentId);

  const getStatusBadge = (submission: any, deadline: string | null) => {
    if (!submission) {
      if (deadline && new Date(deadline) < new Date()) {
        return <Badge variant="destructive">{isAr ? 'فات الموعد' : 'Overdue'}</Badge>;
      }
      return <Badge variant="secondary">{isAr ? 'لم يُسلّم' : 'Not Submitted'}</Badge>;
    }
    if (submission.status === 'graded') {
      return <Badge className="bg-green-600 text-white">{isAr ? 'تم التقييم' : 'Graded'}: {submission.score}</Badge>;
    }
    return <Badge variant="outline">{isAr ? 'تم التسليم' : 'Submitted'}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    );
  }

  if (!assignments?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">{isAr ? 'لا توجد واجبات حالياً' : 'No assignments yet'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{isAr ? 'واجباتي' : 'My Assignments'}</h2>
      {assignments.map((assignment: any) => {
        const submission = getSubmission(assignment.id);
        const isOverdue = assignment.deadline && new Date(assignment.deadline) < new Date() && !submission;

        return (
          <Card key={assignment.id} className={isOverdue ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">
                    {isAr ? assignment.title_ar : assignment.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isAr ? (assignment.courses as any)?.title_ar : (assignment.courses as any)?.title}
                    {' • '}
                    {isAr ? (assignment.chapters as any)?.title_ar : (assignment.chapters as any)?.title}
                  </p>
                </div>
                {getStatusBadge(submission, assignment.deadline)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(assignment.description || assignment.description_ar) && (
                <p className="text-sm text-muted-foreground">
                  {isAr ? assignment.description_ar : assignment.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {assignment.deadline && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {format(new Date(assignment.deadline), 'PPp', { locale: isAr ? ar : undefined })}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {isAr ? `الدرجة القصوى: ${assignment.max_score}` : `Max Score: ${assignment.max_score}`}
                </span>
              </div>

              {submission?.status === 'graded' && submission.feedback && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-1">{isAr ? 'التغذية الراجعة:' : 'Feedback:'}</p>
                  <p className="text-sm">{isAr ? (submission.feedback_ar || submission.feedback) : submission.feedback}</p>
                </div>
              )}

              {!submission && (
                <Button
                  size="sm"
                  onClick={() => setSubmitDialog(assignment.id)}
                  disabled={isOverdue}
                >
                  <Send className="w-4 h-4 me-2" />
                  {isAr ? 'تسليم الواجب' : 'Submit'}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!submitDialog} onOpenChange={() => setSubmitDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? 'تسليم الواجب' : 'Submit Assignment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{isAr ? 'رفع الملف' : 'Upload File'}</label>
              <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialog(null)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => submitMutation.mutate({ assignmentId: submitDialog! })}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (isAr ? 'جاري التسليم...' : 'Submitting...') : (isAr ? 'تسليم' : 'Submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
