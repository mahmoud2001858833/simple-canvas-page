import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { trackXapi, XapiPayload } from '@/lib/xapi';

/**
 * NELC / FutureX technical integration control panel.
 * Lets the admin verify that xAPI statements reach the national LRS.
 */
export const NelcIntegration = () => {
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [running, setRunning] = useState(false);
  const [resending, setResending] = useState(false);


  const { data: courses = [] } = useQuery({
    queryKey: ['nelc-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [], refetch, isFetching } = useQuery({
    queryKey: ['xapi-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xapi_statements')
        .select('id, verb, success, status_code, response, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const runJourney = async () => {
    if (!email || !courseId) {
      toast.error('أدخل بريد المتعلم واختر الدورة');
      return;
    }
    setRunning(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim())
        .maybeSingle();
      if (error || !profile) throw new Error('لم يتم العثور على المتعلم بهذا البريد');

      if (nationalId.trim()) {
        await supabase
          .from('profiles')
          .update({ national_id: nationalId.trim() })
          .eq('id', profile.id);
      }

      const targetUserId = profile.id;
      const journey: XapiPayload[] = [
        { verb: 'registered', courseId, targetUserId },
        { verb: 'initialized', courseId, targetUserId },
        { verb: 'watched', courseId, lessonId: 'VD001', durationSeconds: 622, completion: true, targetUserId },
        { verb: 'completed', courseId, lessonId: 'VD001', durationSeconds: 300, targetUserId },
        { verb: 'attempted', courseId, quizId: 'QZ001', attemptId: 1, score: { raw: 95, min: 0, max: 100, scaled: 0.95 }, success: true, completion: true, targetUserId },
        { verb: 'completed', courseId, quizId: 'QZ001', targetUserId },
        { verb: 'progressed', courseId, score: { scaled: 0.9 }, completion: true, targetUserId },
        { verb: 'completed', courseId, targetUserId },
        { verb: 'rated', courseId, score: { raw: 4, min: 0, max: 5, scaled: 0.8 }, response: 'Great course', targetUserId },
        { verb: 'earned', courseId, certificateUrl: `${window.location.origin}/certificate/12341231`, targetUserId },
      ];

      let ok = 0;
      for (const step of journey) {
        const res: any = await trackXapi(step);
        if (res?.ok) ok++;
        await new Promise((r) => setTimeout(r, 400));
      }

      toast.success(`تم إرسال ${ok} من ${journey.length} عبارة إلى نظام تسجيل التعلم`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'فشل إرسال العبارات');
    } finally {
      setRunning(false);
    }
  };

  const resendFailed = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('xapi-track', {
        body: { resendFailed: true },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.resent === 0) {
        toast.info('لا توجد عبارات فاشلة لإعادة إرسالها');
      } else {
        toast.success(`تمت إعادة إرسال ${d?.resent ?? 0} عبارة — نجح: ${d?.succeeded ?? 0} (آخر رد: HTTP ${d?.lastStatus ?? '-'})`);
      }
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'فشل إعادة الإرسال');
    } finally {
      setResending(false);
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            التكامل التقني مع المركز الوطني للتعليم الإلكتروني (NELC / FutureX)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            تُرسل المنصة عبارات xAPI تلقائياً عند التسجيل في الدورة، بدء التعلم، مشاهدة الفيديو، إكمال الدرس،
            محاولة الاختبار، التقدّم، إكمال الدورة، التقييم، والحصول على الشهادة. استخدم الأداة أدناه لتشغيل
            رحلة تعلم كاملة (10 عبارات) للتحقق من وصول البيانات إلى نظام تسجيل التعلم.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>بريد المتعلم</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="learner@example.com" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهوية الوطنية</Label>
              <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="1051212338" />
            </div>
            <div className="space-y-2">
              <Label>الدورة</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">اختر الدورة</option>
                {courses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.title_ar || c.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runJourney} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 me-2" />}
              تشغيل رحلة التحقق الكاملة
            </Button>
            <Button variant="outline" onClick={resendFailed} disabled={resending}>
              {resending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <RefreshCw className="w-4 h-4 me-2" />}
              إعادة إرسال العبارات الفاشلة
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">كيف يعمل التكامل؟</p>
            <p>
              عند كل حدث تعليمي (التسجيل، فتح الدورة، مشاهدة الدرس، إتمامه، أداء اختبار، التقييم، الحصول على الشهادة)
              تُبنى عبارة xAPI 1.0.3 وتُرسل إلى مستودع سجلات التعلم (LRS) الخاص بالمركز الوطني، وتُحفظ نسخة منها مع رمز
              الرد في السجل بالأسفل.
            </p>
            <p className="mt-2">
              إذا ظهر رمز <strong>403</strong> في السجل فهذا يعني أن المركز الوطني يرفض الاتصال من عنوان خادم المنصة —
              المطلوب من المركز إضافة عنوان الخادم إلى القائمة المسموح بها وتأكيد بيانات بيئة الاختبار، ثم اضغط
              «إعادة إرسال العبارات الفاشلة».
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>سجل العبارات المرسلة</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 me-2 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </Button>

        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pe-2">
            <div className="space-y-2">
              {logs.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد عبارات مرسلة بعد.</p>
              )}
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.success ? 'default' : 'destructive'}>{log.verb}</Badge>
                      <span className="text-xs text-muted-foreground">HTTP {log.status_code}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-all line-clamp-2">
                      {log.response || '—'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('ar-SA')}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
