import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Video, CreditCard, FileText, User, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useState } from 'react';
import { ListSkeleton } from '@/components/ui/skeletons';

type LogType = 'all' | 'video' | 'payment' | 'request';

export const SystemLogs = () => {
  const { language, dir } = useLanguage();
  const [search, setSearch] = useState('');
  const [logType, setLogType] = useState<LogType>('all');

  // Fetch video access logs
  const { data: videoLogs, isLoading: loadingVideoLogs } = useQuery({
    queryKey: ['video-access-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_access_logs')
        .select(`
          *,
          lessons:lesson_id (title, title_ar)
        `)
        .order('accessed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data?.map((log: any) => ({
        ...log,
        type: 'video',
        title: language === 'ar' ? log.lessons?.title_ar : log.lessons?.title,
        timestamp: log.accessed_at,
      }));
    },
    enabled: logType === 'all' || logType === 'video',
  });

  // Fetch payment logs
  const { data: paymentLogs, isLoading: loadingPaymentLogs } = useQuery({
    queryKey: ['payment-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          profiles:user_id (full_name, email),
          courses:course_id (title, title_ar)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data?.map((payment: any) => ({
        ...payment,
        type: 'payment',
        title: `${payment.amount} SAR - ${payment.profiles?.full_name || payment.profiles?.email}`,
        timestamp: payment.created_at,
      }));
    },
    enabled: logType === 'all' || logType === 'payment',
  });

  // Fetch request logs
  const { data: requestLogs, isLoading: loadingRequestLogs } = useQuery({
    queryKey: ['request-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_course_requests')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data?.map((request: any) => ({
        ...request,
        type: 'request',
        timestamp: request.updated_at || request.created_at,
      }));
    },
    enabled: logType === 'all' || logType === 'request',
  });

  // Combine and sort logs
  const allLogs = [
    ...(videoLogs || []),
    ...(paymentLogs || []),
    ...(requestLogs || []),
  ]
    .filter((log) => {
      if (!search) return true;
      const searchLower = search.toLowerCase();
      return (
        log.title?.toLowerCase().includes(searchLower) ||
        log.status?.toLowerCase().includes(searchLower) ||
        log.user_id?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  const isLoading = loadingVideoLogs || loadingPaymentLogs || loadingRequestLogs;

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'payment':
        return <CreditCard className="w-4 h-4" />;
      case 'request':
        return <FileText className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'bg-blue-500/10 text-blue-600';
      case 'payment':
        return 'bg-green-500/10 text-green-600';
      case 'request':
        return 'bg-purple-500/10 text-purple-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-green-500/10 text-green-600',
      pending: 'bg-yellow-500/10 text-yellow-600',
      failed: 'bg-red-500/10 text-red-600',
      completed: 'bg-green-500/10 text-green-600',
      in_progress: 'bg-blue-500/10 text-blue-600',
    };
    return styles[status] || 'bg-gray-500/10 text-gray-600';
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold mb-2">
          {language === 'ar' ? 'سجلات النظام' : 'System Logs'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'مراقبة نشاط النظام والمستخدمين' : 'Monitor system and user activity'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === 'ar' ? 'بحث في السجلات...' : 'Search logs...'}
            className="ps-10"
          />
        </div>
        <Select value={logType} onValueChange={(v: LogType) => setLogType(v)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="w-4 h-4 me-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'جميع السجلات' : 'All Logs'}</SelectItem>
            <SelectItem value="video">{language === 'ar' ? 'الوصول للفيديو' : 'Video Access'}</SelectItem>
            <SelectItem value="payment">{language === 'ar' ? 'المدفوعات' : 'Payments'}</SelectItem>
            <SelectItem value="request">{language === 'ar' ? 'الطلبات' : 'Requests'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="card-premium">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{videoLogs?.length || 0}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'مشاهدات' : 'Video Views'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{paymentLogs?.length || 0}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'مدفوعات' : 'Payments'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{requestLogs?.length || 0}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'طلبات' : 'Requests'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs List */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            {language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' ? 'آخر 100 نشاط' : 'Last 100 activities'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton rows={10} />
          ) : allLogs.length ? (
            <div className="space-y-2">
              {allLogs.map((log, index) => (
                <div
                  key={`${log.type}-${log.id}-${index}`}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getLogColor(log.type)}`}>
                    {getLogIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {log.type === 'video' && (
                        <span>{language === 'ar' ? 'مشاهدة:' : 'Viewed:'} {log.title}</span>
                      )}
                      {log.type === 'payment' && (
                        <span>{log.title}</span>
                      )}
                      {log.type === 'request' && (
                        <span>{log.title}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), 'PPp', {
                        locale: language === 'ar' ? ar : undefined,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.status && (
                      <Badge variant="secondary" className={getStatusBadge(log.status)}>
                        {log.status}
                      </Badge>
                    )}
                    <Badge variant="outline" className={getLogColor(log.type)}>
                      {log.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {language === 'ar' ? 'لا توجد سجلات' : 'No logs found'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
