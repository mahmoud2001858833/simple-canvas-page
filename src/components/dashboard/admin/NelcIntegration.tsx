import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, RefreshCw, Stethoscope, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { trackXapi, XapiPayload, isValidNationalId } from '@/lib/xapi';

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
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);


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
    if (nationalId.trim() && !isValidNationalId(nationalId)) {
      toast.error('رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2 أو 4');
      return;
    }
    setRunning(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, national_id')
        .eq('email', email.trim())
        .maybeSingle();
      if (error || !profile) throw new Error('لم يتم العثور على المتعلم بهذا البريد');

      if (nationalId.trim()) {
        await supabase
          .from('profiles')
          .update({ national_id: nationalId.trim() })
          .eq('id', profile.id);
      } else if (!isValidNationalId(profile.national_id || '')) {
        throw new Error('المتعلم لا يملك رقم هوية صالح — أدخل رقم الهوية أولاً');
      }

      const targetUserId = profile.id;
      const unit = (n: number) => `MD00${n}`;

      // Official NELC learner engagement scenario (registered → certificate)
      const journey: XapiPayload[] = [
        { verb: 'registered', courseId, objectKind: 'course', targetUserId },
        { verb: 'initialized', courseId, objectKind: 'course', targetUserId },
      ];

      [1, 2, 3].forEach((u) => {
        const moduleId = unit(u);
        journey.push(
          {
            verb: 'watched', courseId, moduleId, lessonId: `VD00${u}`, objectKind: 'video',
            objectName: `Unit ${u} - Video ${u}`, durationSeconds: 622, completion: true, targetUserId,
          },
          {
            verb: 'completed', courseId, moduleId, lessonId: `LSN00${u}`, objectKind: 'lesson',
            objectName: `Unit ${u} - Lesson ${u}`, durationSeconds: 300, targetUserId,
          },
          {
            verb: 'attended', courseId, moduleId, lessonId: `VC00${u}`, objectKind: 'virtual-classroom',
            objectName: `Unit ${u} - Live session`, durationSeconds: 5400, completion: true, targetUserId,
          },
          {
            verb: 'attempted', courseId, moduleId, quizId: `QZ00${u}`, objectKind: 'quiz',
            objectName: `Unit ${u} - Quiz`, attemptId: 1,
            score: { raw: 95, min: 0, max: 100, scaled: 0.95 }, success: true, completion: false, targetUserId,
          },
          {
            verb: 'completed', courseId, moduleId, objectKind: 'module',
            objectName: `Unit ${u}`, targetUserId,
          },
          {
            verb: 'progressed', courseId, objectKind: 'course',
            score: { scaled: Number((u * 0.3).toFixed(2)) }, completion: u === 3,
            targetUserId, allowDuplicate: true,
          },
        );
      });

      journey.push(
        { verb: 'completed', courseId, objectKind: 'course', targetUserId },
        {
          verb: 'rated', courseId, objectKind: 'course',
          score: { raw: 4, min: 0, max: 5, scaled: 0.8 }, response: 'Great course', targetUserId,
        },
        {
          verb: 'earned', courseId, objectKind: 'certificate', lessonId: 'CFT001',
          objectName: 'Certificate of completion',
          certificateUrl: `${window.location.origin}/certificate/${courseId}`, targetUserId,
        },
      );

      let ok = 0;
      let skipped = 0;
      for (const step of journey) {
        const res: any = await trackXapi(step);
        if (res?.duplicate) skipped++;
        else if (res?.ok) ok++;
        await new Promise((r) => setTimeout(r, 350));
      }

      toast.success(
        `تم إرسال ${ok} من ${journey.length} عبارة${skipped ? ` (تم تخطي ${skipped} مكررة)` : ''}`,
      );
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

  /** Runs NELC's own connectivity checks from the sending server. */
  const runDiagnostics = async () => {
    setDiagnosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('nelc-diagnostics', { body: {} });
      if (error) throw error;
      setDiagnostics(data);
      toast.success('تم تشغيل التشخيص');
    } catch (e: any) {
      toast.error(e.message || 'فشل تشغيل التشخيص');
    } finally {
      setDiagnosing(false);
    }
  };

  const diagnosticsReport = diagnostics
    ? [
        `1) رابط منصة التعلّم: ${diagnostics.platformUrl}`,
        `   قيمة context.platform المرسلة: ${diagnostics.platformKey}`,
        `2) عنوان IP العام الصادر عنه الإرسال (من cdn-cgi/trace داخل بيئة التشغيل): ${diagnostics.outgoingIp ?? 'غير متاح'}`,
        `3) نتيجة GET ${diagnostics.about?.url}: HTTP ${diagnostics.about?.status}` +
          `${diagnostics.about?.rayId ? ` | Ray ID: ${diagnostics.about.rayId}` : ''}` +
          `${diagnostics.about?.errorCode ? ` | Error code: ${diagnostics.about.errorCode}` : ''}` +
          `${diagnostics.about?.blockedIp ? ` | IP على صفحة الحجب: ${diagnostics.about.blockedIp}` : ''}`,
        `   نفس الطلب بتوقيع العميل الافتراضي: HTTP ${diagnostics.aboutWithDefaultUserAgent?.status}` +
          `${diagnostics.aboutWithDefaultUserAgent?.errorCode ? ` (Error code ${diagnostics.aboutWithDefaultUserAgent.errorCode})` : ''}`,
        `4) قيمة User-Agent التي يرسلها عميلنا: ${diagnostics.userAgent}`,
        `الخلاصة: ${diagnostics.verdict}`,
        `وقت الفحص: ${diagnostics.checkedAt}`,
      ].join('\n')
    : '';


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
            <Button variant="secondary" onClick={runDiagnostics} disabled={diagnosing}>
              {diagnosing ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Stethoscope className="w-4 h-4 me-2" />}
              تشخيص الاتصال
            </Button>
          </div>

          {diagnostics && (
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">تقرير التشخيص (جاهز للإرسال للمركز الوطني)</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(diagnosticsReport);
                    toast.success('تم نسخ التقرير');
                  }}
                >
                  <Copy className="w-4 h-4 me-2" />
                  نسخ
                </Button>
              </div>
              <p className="text-sm">{diagnostics.verdict}</p>
              <pre dir="ltr" className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs leading-6">
                {diagnosticsReport}
              </pre>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">كيف يعمل التكامل؟</p>
            <p>
              عند كل حدث تعليمي (التسجيل، فتح الدورة، مشاهدة الدرس، إتمامه، أداء اختبار، التقييم، الحصول على الشهادة)
              تُبنى عبارة xAPI 1.0.3 وتُرسل إلى مستودع سجلات التعلم (LRS) الخاص بالمركز الوطني، وتُحفظ نسخة منها مع رمز
              الرد في السجل بالأسفل.
            </p>
            <p className="mt-2">
              عند ظهور <strong>403</strong>: اضغط «تشخيص الاتصال». إذا ظهر <strong>Error code 1010</strong> فالسبب توقيع
              العميل (User-Agent) وقد تمّت معالجته من جهتنا. أما إذا ظهرت صفحة حجب تحمل <strong>Ray ID</strong> وعنوان IP
              بدون رمز خطأ فالحجب على مستوى العنوان، وعندها أرسل التقرير المنسوخ إلى المركز الوطني.
            </p>
            <p className="mt-2">
              بعد أي إصلاح اضغط «إعادة إرسال العبارات الفاشلة» وراقب رمز الرد في السجل بالأسفل.
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
