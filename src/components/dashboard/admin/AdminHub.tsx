import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminStats } from '@/components/dashboard/admin/AdminStats';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Users,
  BookOpenCheck,
  FileText,
  Wallet,
  MessageSquare,
  CreditCard,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface AdminHubProps {
  onNavigate: (tab: string) => void;
}

export const AdminHub = ({ onNavigate }: AdminHubProps) => {
  const { language, dir } = useLanguage();
  const isRTL = language === 'ar';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: alerts } = useQuery({
    queryKey: ['admin-hub-alerts'],
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [approvals, requests, withdrawals, support, abandoned, captures] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('custom_course_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_chats').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', dayAgo),
        supabase.from('screen_capture_attempts').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
      ]);
      return {
        approvals: approvals.count || 0,
        requests: requests.count || 0,
        withdrawals: withdrawals.count || 0,
        support: support.count || 0,
        abandoned: abandoned.count || 0,
        captures: captures.count || 0,
      };
    },
    staleTime: 60000,
  });

  const alertCards = [
    {
      id: 'course-approvals',
      icon: BookOpenCheck,
      count: alerts?.approvals || 0,
      label: isRTL ? 'دورات بانتظار الاعتماد' : 'Courses awaiting approval',
      tone: 'bg-warning/10 text-warning border-warning/30',
    },
    {
      id: 'requests',
      icon: FileText,
      count: alerts?.requests || 0,
      label: isRTL ? 'طلبات دورات مخصصة معلقة' : 'Pending custom requests',
      tone: 'bg-info/10 text-info border-info/30',
    },
    {
      id: 'withdrawals',
      icon: Wallet,
      count: alerts?.withdrawals || 0,
      label: isRTL ? 'طلبات سحب أرباح' : 'Withdrawal requests',
      tone: 'bg-secondary/10 text-secondary border-secondary/30',
    },
    {
      id: 'support',
      icon: MessageSquare,
      count: alerts?.support || 0,
      label: isRTL ? 'محادثات دعم مفتوحة' : 'Open support chats',
      tone: 'bg-primary/10 text-primary border-primary/30',
    },
    {
      id: 'abandoned-payments',
      icon: CreditCard,
      count: alerts?.abandoned || 0,
      label: isRTL ? 'مدفوعات مهجورة (+24 ساعة)' : 'Abandoned payments (24h+)',
      tone: 'bg-destructive/10 text-destructive border-destructive/30',
    },
    {
      id: 'capture-attempts',
      icon: ShieldAlert,
      count: alerts?.captures || 0,
      label: isRTL ? 'محاولات تسجيل شاشة (24 ساعة)' : 'Screen capture attempts (24h)',
      tone: 'bg-destructive/10 text-destructive border-destructive/30',
    },
  ];

  const quickLinks = [
    { id: 'users', icon: Users, label: isRTL ? 'إدارة المستخدمين' : 'Manage users' },
    { id: 'courses', icon: BookOpenCheck, label: isRTL ? 'إدارة الدورات' : 'Manage courses' },
    { id: 'financial-dashboard', icon: Wallet, label: isRTL ? 'اللوحة المالية' : 'Financial dashboard' },
    { id: 'payment-methods', icon: CreditCard, label: isRTL ? 'طرق الدفع للدورات' : 'Course payment methods' },
    { id: 'reports', icon: FileText, label: isRTL ? 'التقارير' : 'Reports' },
    { id: 'general', icon: ShieldAlert, label: isRTL ? 'إعدادات المنصة' : 'Platform settings' },
  ];

  const activeAlerts = alertCards.filter((a) => a.count > 0);

  return (
    <div className="space-y-8" dir={dir}>
      <AdminStats />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h2 className="text-lg font-bold">
            {isRTL ? 'يحتاج انتباهك الآن' : 'Needs your attention'}
          </h2>
          {activeAlerts.length > 0 && (
            <Badge variant="secondary">{activeAlerts.length}</Badge>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {isRTL ? 'لا توجد مهام عاجلة حالياً. كل شيء تحت السيطرة.' : 'No urgent tasks right now. Everything is under control.'}
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAlerts.map((a) => (
              <button
                key={a.id}
                onClick={() => onNavigate(a.id)}
                className={`text-start rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${a.tone}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <a.icon className="w-5 h-5" />
                  <span className="text-2xl font-bold">{a.count}</span>
                </div>
                <div className="text-sm font-medium text-foreground/80">{a.label}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{isRTL ? 'وصول سريع' : 'Quick access'}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((l) => (
            <Card key={l.id} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <l.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="flex-1 text-sm font-medium">{l.label}</span>
              <Button size="icon" variant="ghost" onClick={() => onNavigate(l.id)} aria-label={l.label}>
                <Arrow className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
