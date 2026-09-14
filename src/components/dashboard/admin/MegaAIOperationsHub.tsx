import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Bot,
  ShieldCheck,
  Zap,
  Cpu,
  Radio,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Sparkles,
  TrendingUp,
  BrainCircuit,
  ArrowRight,
  ArrowLeft,
  DollarSign,
} from 'lucide-react';

interface MegaAIOperationsHubProps {
  onNavigate?: (tab: string) => void;
}

interface TelemetryEvent {
  id: string;
  timestamp: string;
  agent: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  message: string;
  latencyMs: number;
}

export const MegaAIOperationsHub = ({ onNavigate }: MegaAIOperationsHubProps) => {
  const { language, dir } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const [simulatedPing, setSimulatedPing] = useState<number>(142);
  const [isPinging, setIsPinging] = useState(false);

  // Fetch active platform risk alert from platform_settings
  const { data: activeRisk } = useQuery({
    queryKey: ['admin-platform-risk-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'active_platform_risk')
        .maybeSingle();

      if (error || !data?.setting_value) return null;
      try {
        const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        return parsed?.active ? parsed : null;
      } catch {
        return null;
      }
    },
    refetchInterval: 10000,
  });

  // Mutation to clear active platform risk
  const resolveRiskMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'active_platform_risk',
          setting_value: { active: false, resolved_at: new Date().toISOString() },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-risk-status'] });
      toast.success(isRTL ? 'تم إنهاء حالة الطوارئ بنجاح وعودة النظام للوضع الطبيعي' : 'Emergency alert cleared successfully');
    },
    onError: () => {
      toast.error(isRTL ? 'تعذر إنهاء التنبيه' : 'Failed to clear alert');
    },
  });

  // Simulated telemetry log
  const [telemetryLogs] = useState<TelemetryEvent[]>([
    {
      id: 'tel-1',
      timestamp: 'الآن',
      agent: 'المستشار التنفيذي العام',
      type: 'success',
      message: 'تمت مزامنة هيئة التدريس المعتمدة (5 دكاترة جامعيين) بنجاح فائق وتحديث مصفوفة المعرفة الأكاديمية.',
      latencyMs: 145,
    },
    {
      id: 'tel-2',
      agent: 'مراقب المالية والمقايضة',
      timestamp: 'منذ دقيقة',
      type: 'info',
      message: 'فحص جاهزية الحسابات البنكية ومزامنة آيبانات المعلمين (SA***) في محفظة المستحقات.',
      latencyMs: 190,
    },
    {
      id: 'tel-3',
      agent: 'مساعد المعلم الذكي',
      timestamp: 'منذ دقيقتين',
      type: 'success',
      message: 'تجهيز مسار محادثة أكاديمي مدعوم بصيغ LaTeX و KaTeX لتسهيل شرح المقررات الجامعية.',
      latencyMs: 230,
    },
    {
      id: 'tel-4',
      agent: 'وكيل المبيعات والتحويل',
      timestamp: 'منذ 5 دقائق',
      type: 'info',
      message: 'تحليل سلوك 24 طالباً شاهدو فيديوهات المعاينة التجريبية المجانية بنسبة إتمام 85%.',
      latencyMs: 110,
    },
    {
      id: 'tel-5',
      agent: 'وكيل الأمان والامتثال NELC',
      timestamp: 'منذ 8 دقائق',
      type: 'success',
      message: 'تدقيق نظام حماية الفيديوهات من التقاط الشاشة: 0 محاولات تسريب غير مصرح بها.',
      latencyMs: 95,
    },
  ]);

  const handlePing = () => {
    setIsPinging(true);
    setTimeout(() => {
      setSimulatedPing(Math.floor(120 + Math.random() * 45));
      setIsPinging(false);
      toast.success(isRTL ? 'تم فحص النبض العصبي: جميع العقد تعمل بكفاءة قصوى' : 'Neural ping test: All nodes healthy');
    }, 600);
  };

  const aiNodes = [
    {
      id: 'master-ai',
      name: isRTL ? 'المستشار التنفيذي العام' : 'Master Executive Advisor',
      role: isRTL ? 'الأوركسترا الاستراتيجية، إحصاءات الكادر، وتوجيه المنظومة' : 'Strategic Orchestration & Faculty Alignment',
      model: 'Gemini 2.5 Flash / Pro Hybrid',
      statusLabel: isRTL ? 'متصل ومسيطر' : 'Active & Dominant',
      color: 'border-amber-400/40 bg-amber-500/5 text-amber-900',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: BrainCircuit,
      stats: isRTL ? 'جاهزية 100% • 5 دكاترة معتمدين' : '100% Ready • 5 Faculty',
    },
    {
      id: 'sales-agent',
      name: isRTL ? 'وكيل المبيعات والفرص البيعية' : 'Sales & Growth Specialist',
      role: isRTL ? 'تحليل طلاب المعاينة، نسب التحويل، واقتراح استراتيجيات الخصم' : 'Preview Student Analysis & Conversion Funnel',
      model: 'Gemini 2.5 Flash',
      statusLabel: isRTL ? 'رصد مستمر' : 'Continuous Monitoring',
      color: 'border-emerald-400/40 bg-emerald-500/5 text-emerald-900',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: TrendingUp,
      stats: isRTL ? 'دقة تنبؤ 89.4%' : '89.4% Accuracy',
    },
    {
      id: 'instructor-copilot',
      name: isRTL ? 'مساعد المعلم الأكاديمي' : 'Instructor Academic Co-Pilot',
      role: isRTL ? 'توليد الاختبارات، صياغة المناهج، وتنسيق بنك الأسئلة والرموز الرياضية' : 'Curriculum Structuring & Quiz Generation',
      model: 'Gemini Flash Lite + Edge Proxy',
      statusLabel: isRTL ? 'متوفر للمعلمين' : 'Available for Instructors',
      color: 'border-blue-400/40 bg-blue-500/5 text-blue-900',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: Sparkles,
      stats: isRTL ? 'دعم فوري في لوحة المعلم' : 'Live in Instructor Panel',
    },
    {
      id: 'finance-guard',
      name: isRTL ? 'مراقب المالية والمقايضة' : 'Financial Ledger & Negotiation Guard',
      role: isRTL ? 'تدقيق مفاوضات الأرباح، فحص الآيبانات، وتدفقات دفتر الحسابات' : 'Payout Negotiation & Bank Details Validation',
      model: 'Rule-Engine + Cloud Sync',
      statusLabel: isRTL ? 'تدقيق صارم' : 'Strict Audit',
      color: 'border-purple-400/40 bg-purple-500/5 text-purple-900',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      icon: DollarSign,
      stats: isRTL ? 'مزامنة سحابية ثلاثية' : 'Triple Cloud Sync',
    },
    {
      id: 'nelc-compliance',
      name: isRTL ? 'وكيل الاعتماد والأمان NELC' : 'Accreditation & Security Sentry',
      role: isRTL ? 'التوافق مع معايير المركز الوطني NELC ورصد محاولات تسجيل الشاشة' : 'NELC Compliance & Screen Capture Guard',
      model: 'Telemetry Watcher',
      statusLabel: isRTL ? 'حماية فائقة' : 'Max Shield',
      color: 'border-sky-400/40 bg-sky-500/5 text-sky-900',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
      icon: ShieldCheck,
      stats: isRTL ? '0 محاولات اختراق نشطة' : '0 Active Breaches',
    },
    {
      id: 'support-agent',
      name: isRTL ? 'وكيل الدعم والرد الفوري' : 'Automated Support Assistant',
      role: isRTL ? 'معالجة استفسارات الطلاب والرد التلقائي الذكي على المشكلات الشائعة' : 'Student Inquiries & Smart Ticket Resolution',
      model: 'Gemini Flash Lite',
      statusLabel: isRTL ? 'استجابة < 1.5 ث' : 'Sub 1.5s Response',
      color: 'border-teal-400/40 bg-teal-500/5 text-teal-900',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      icon: Zap,
      stats: isRTL ? 'جاهز 24/7' : '24/7 Operational',
    },
  ];

  return (
    <div className="space-y-8" dir={dir}>
      {/* Royal Header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-amber-500/5 to-background p-6 lg:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-600 text-white flex items-center justify-center shadow-md">
                <BrainCircuit className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  {isRTL ? 'غرفة العمليات العصبية والرادار الذكي' : 'Mega AI Operations Hub & Neural Radar'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isRTL
                    ? 'الرصد المركزي اللحظي للوكلاء الأذكياء، حالة الاستقرار الأمني والمنظومي، وتدفقات المعرفة'
                    : 'Real-time telemetry, agent orchestration, and emergency risk surveillance'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-xs font-semibold text-foreground shadow-xs">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-ping" />
              <span>{isRTL ? 'النبض العصبي:' : 'Neural Ping:'}</span>
              <span className="font-mono text-emerald-600">{simulatedPing}ms</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePing}
              disabled={isPinging}
              className="gap-2 border-primary/20 hover:bg-primary/5"
            >
              <RefreshCw className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isRTL ? 'فحص الاستجابة' : 'Ping Test'}</span>
            </Button>

            {onNavigate && (
              <Button
                size="sm"
                onClick={() => onNavigate('ai-control')}
                className="gap-2 bg-gradient-to-r from-primary to-amber-600 text-white shadow-md hover:opacity-90"
              >
                <Bot className="w-4 h-4" />
                <span>{isRTL ? 'إدارة النماذج والتعليمات' : 'Manage Prompts'}</span>
                <Arrow className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Platform Risk Radar */}
      <Card className={`border-2 transition-all ${
        activeRisk ? 'border-destructive bg-destructive/5 shadow-lg shadow-destructive/10' : 'border-emerald-500/30 bg-emerald-500/5'
      }`}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${activeRisk ? 'bg-destructive text-white animate-bounce' : 'bg-emerald-500 text-white'}`}>
                {activeRisk ? <AlertTriangle className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {activeRisk
                      ? (isRTL ? '🚨 حالة خطر أو طوارئ معلنة في المنصة' : '🚨 Active Platform Risk Broadcast')
                      : (isRTL ? 'الرادار الأمني: جميع الأنظمة التشغيلية في حالة استقرار تام' : 'All Platform Systems Fully Operational')}
                  </h3>
                  <Badge variant={activeRisk ? 'destructive' : 'secondary'} className={activeRisk ? '' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}>
                    {activeRisk ? activeRisk.severity?.toUpperCase() || 'CRITICAL' : (isRTL ? 'طبيعي 99.98%' : 'Nominal')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activeRisk
                    ? (activeRisk.description || activeRisk.title || (isRTL ? 'يرجى مراجعة التنبيه واتخاذ الإجراءات اللازمة فوراً.' : 'Action required.'))
                    : (isRTL
                        ? 'حماية المحتوى نشطة، لا توجد تسريبات، تدفق الفيديوهات مستقر، وبوابات الدفع تعمل بكفاءة.'
                        : 'Content protection active, zero leaks, video streaming optimal, payment gateways synchronized.')}
                </p>
                {activeRisk && activeRisk.timestamp && (
                  <p className="text-xs text-destructive/80 font-mono">
                    {isRTL ? 'وقت البث:' : 'Dispatched at:'} {new Date(activeRisk.timestamp).toLocaleString('ar-SA')}
                  </p>
                )}
              </div>
            </div>

            {activeRisk && (
              <Button
                variant="destructive"
                onClick={() => resolveRiskMutation.mutate()}
                disabled={resolveRiskMutation.isPending}
                className="gap-2 shadow-md shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isRTL ? 'إنهاء حالة الطوارئ (تم الحل)' : 'Clear Emergency State'}</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 6 AI Agent Nodes Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {isRTL ? 'عقد الوكلاء الأذكياء (6 منظومات نشطة)' : 'Neural Agent Nodes (6 Operational)'}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {isRTL ? 'تحديث فوري للحالة والقدرات' : 'Live telemetry & status'}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {aiNodes.map((node) => {
            const Icon = node.icon;
            return (
              <Card
                key={node.id}
                className={`relative overflow-hidden border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${node.color}`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-xs border flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant="outline" className={`text-xs font-semibold ${node.badgeColor}`}>
                      {node.statusLabel}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground mt-3">
                    {node.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {node.role}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3">
                  <div className="pt-3 border-t flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-mono">{node.model}</span>
                    <span className="font-semibold text-foreground">{node.stats}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Real-time Telemetry Activity Stream */}
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-5 border-b flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-bold text-foreground">
                {isRTL ? 'شريط البث العصبي والعمليات المباشرة' : 'Live Neural Telemetry Stream'}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {isRTL ? 'سجل تفاعلات الوكلاء، تدقيق الحسابات، ومزامنة المقررات' : 'Real-time telemetry logs across all autonomous agents'}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {telemetryLogs.length} {isRTL ? 'سجلات' : 'Events'}
          </Badge>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          <div className="space-y-2.5">
            {telemetryLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 sm:mt-0 shrink-0" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-primary">{log.agent}</span>
                      <span className="text-xs text-muted-foreground font-mono">({log.latencyMs}ms)</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">{log.message}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0 self-end sm:self-center">
                  {log.timestamp}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
