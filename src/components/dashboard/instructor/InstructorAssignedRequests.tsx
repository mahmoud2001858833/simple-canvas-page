import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RequestChat } from '@/components/dashboard/student/RequestChat';
import { Loader2, FileText, Download, ExternalLink, User, Mail, Phone, Calendar, Sparkles, GraduationCap, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export const InstructorAssignedRequests = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['instructor-assigned-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_course_requests')
        .select('*')
        .eq('assigned_instructor_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return await Promise.all((data || []).map(async (r) => {
        const { data: student } = await supabase
          .from('profiles')
          .select('full_name, full_name_ar, email, phone, academic_year, institution_name')
          .eq('id', r.user_id)
          .maybeSingle();
        const { data: files } = await supabase
          .from('request_files')
          .select('*')
          .eq('request_id', r.id);
        return { ...r, student, files: files || [] };
      }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase
        .from('custom_course_requests')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-assigned-requests'] });
      toast.success(language === 'ar' ? 'تم تحديث الحالة' : 'Status updated');
    },
    onError: () => toast.error(language === 'ar' ? 'تعذر تحديث الحالة' : 'Failed to update status'),
  });

  const openFile = async (fileUrl: string) => {
    try {
      const match = fileUrl.match(/request-files\/(.+)/);
      if (match) {
        const { data, error } = await supabase.storage
          .from('request-files')
          .createSignedUrl(decodeURIComponent(match[1]), 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
        return;
      }
      window.open(fileUrl, '_blank');
    } catch {
      toast.error(language === 'ar' ? 'تعذر فتح الملف' : 'Failed to open file');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!requests?.length) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <Inbox className="w-10 h-10 opacity-50" />
          <p>{language === 'ar' ? 'لا توجد طلبات دورات محالة إليك حالياً' : 'No course requests assigned to you yet'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{language === 'ar' ? 'الطلبات المحالة إليّ' : 'Requests Assigned to Me'}</h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar'
            ? 'الدورات الخاصة التي أحالها الأدمن إليك مع بيانات الطالب وملفاته'
            : 'Custom course requests assigned to you, with student details and files'}
        </p>
      </div>

      {requests.map((r: any) => (
        <Card key={r.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                {r.title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{r.status}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  {openId === r.id ? (language === 'ar' ? 'إخفاء' : 'Hide') : (language === 'ar' ? 'التفاصيل' : 'Details')}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(r.created_at), 'PPP', { locale: language === 'ar' ? ar : enUS })}
            </p>
          </CardHeader>

          {openId === r.id && (
            <CardContent className="space-y-4">
              {r.description && <p className="text-sm whitespace-pre-wrap">{r.description}</p>}

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {r.course_name && <div><span className="text-muted-foreground">{language === 'ar' ? 'المادة: ' : 'Subject: '}</span>{r.course_name}</div>}
                {r.specialty && <div><span className="text-muted-foreground">{language === 'ar' ? 'التخصص: ' : 'Specialty: '}</span>{r.specialty}</div>}
                {r.institution && <div><span className="text-muted-foreground">{language === 'ar' ? 'الجهة الأكاديمية: ' : 'Institution: '}</span>{r.institution}</div>}
                {r.academic_year && <div><span className="text-muted-foreground">{language === 'ar' ? 'السنة الأكاديمية: ' : 'Academic year: '}</span>{r.academic_year}</div>}
                {r.doctor_name && <div><span className="text-muted-foreground">{language === 'ar' ? 'اسم المحاضر: ' : 'Lecturer: '}</span>{r.doctor_name}</div>}
                <div><span className="text-muted-foreground">{language === 'ar' ? 'طريقة التقديم: ' : 'Delivery: '}</span>{r.delivery_method}</div>
              </div>

              <Separator />

              {/* Student */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2"><User className="w-4 h-4" />{language === 'ar' ? 'الطالب صاحب الطلب' : 'Requesting Student'}</h4>
                <div className="grid sm:grid-cols-2 gap-2 text-sm bg-muted/50 rounded-lg p-3">
                  <div>{r.student?.full_name_ar || r.student?.full_name || '—'}</div>
                  {r.student?.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.student.email}</div>}
                  {r.student?.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.student.phone}</div>}
                  {r.student?.institution_name && <div>{r.student.institution_name}</div>}
                </div>
              </div>

              {/* Files */}
              {r.files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" />{language === 'ar' ? 'ملفات الطالب' : 'Student Files'}</h4>
                  {r.files.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 border rounded-lg p-2 text-sm">
                      <span className="truncate">{f.file_name}</span>
                      <Button variant="outline" size="sm" onClick={() => openFile(f.file_url)}>
                        <ExternalLink className="w-4 h-4 me-1" />
                        {language === 'ar' ? 'فتح' : 'Open'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI analysis */}
              {r.ai_analysis && (
                <div className="space-y-2 rounded-lg border p-3 bg-primary/5">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />{language === 'ar' ? 'تحليل الذكاء الاصطناعي' : 'AI Analysis'}</h4>
                  <p className="text-sm">{r.ai_analysis.summary}</p>
                  {Array.isArray(r.ai_analysis.advice) && (
                    <ul className="list-disc ps-5 text-sm space-y-1">
                      {r.ai_analysis.advice.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex flex-wrap items-center gap-3">
                <Select value={r.status} onValueChange={(status) => updateStatus.mutate({ id: r.id, status })}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</SelectItem>
                    <SelectItem value="in_progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                    <SelectItem value="delayed">{language === 'ar' ? 'متأخر' : 'Delayed'}</SelectItem>
                    <SelectItem value="urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
                    <SelectItem value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</SelectItem>
                  </SelectContent>
                </Select>
                <RequestChat requestId={r.id} requestTitle={r.title} />
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};
