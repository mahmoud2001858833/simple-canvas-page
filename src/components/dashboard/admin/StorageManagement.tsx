import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HardDrive, Video, FileText, Image, AlertTriangle, RefreshCw, Trash2, Download, FolderOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface BucketStats {
  id: string;
  name: string;
  name_ar: string;
  used: number;
  files_count: number;
}

interface StorageStatsData {
  buckets: BucketStats[];
  total_used: number;
  storage_limit: number;
  usage_percent: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getBucketIcon = (bucketId: string) => {
  switch (bucketId) {
    case 'course-videos':
      return Video;
    case 'request-files':
      return FileText;
    case 'chat-images':
      return Image;
    default:
      return HardDrive;
  }
};

const getProgressColor = (percent: number): string => {
  if (percent >= 90) return 'bg-destructive';
  if (percent >= 70) return 'bg-warning';
  return 'bg-success';
};

const storagePlans = [
  { id: 'free', name: 'Free', limit: 1 * 1024 * 1024 * 1024, price: 'مجاني' },
  { id: 'pro', name: 'Pro', limit: 8 * 1024 * 1024 * 1024, price: '$25/شهر' },
  { id: 'team', name: 'Team', limit: 100 * 1024 * 1024 * 1024, price: '$599/شهر' },
  { id: 'enterprise', name: 'Enterprise', limit: 1024 * 1024 * 1024 * 1024, price: 'مخصص' },
];

export const StorageManagement = () => {
  const { language } = useLanguage();

  const { data: stats, isLoading, error, refetch, isFetching } = useQuery<StorageStatsData>({
    queryKey: ['storage-stats'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('get-storage-stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const usagePercent = stats?.usage_percent || 0;
  const progressColorClass = getProgressColor(usagePercent);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <HardDrive className="w-7 h-7 text-primary" />
            {language === 'ar' ? 'مساحة التخزين' : 'Storage Management'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' ? 'إدارة ومراقبة مساحة التخزين' : 'Manage and monitor storage space'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 me-2 ${isFetching ? 'animate-spin' : ''}`} />
          {language === 'ar' ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span>{language === 'ar' ? 'فشل في تحميل إحصائيات التخزين' : 'Failed to load storage stats'}</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main Storage Overview Card */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{language === 'ar' ? 'نظرة عامة على التخزين' : 'Storage Overview'}</span>
                <Badge variant={usagePercent >= 90 ? 'destructive' : usagePercent >= 70 ? 'secondary' : 'default'}>
                  {usagePercent}% {language === 'ar' ? 'مستخدم' : 'used'}
                </Badge>
              </CardTitle>
              <CardDescription>
                {language === 'ar' 
                  ? `${formatBytes(stats?.total_used || 0)} من ${formatBytes(stats?.storage_limit || 0)} مستخدم`
                  : `${formatBytes(stats?.total_used || 0)} of ${formatBytes(stats?.storage_limit || 0)} used`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${progressColorClass}`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>{formatBytes(stats?.storage_limit || 0)}</span>
                </div>
              </div>

              {/* Warning Alert */}
              {usagePercent >= 80 && (
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                  usagePercent >= 90 
                    ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                    : 'bg-warning/10 text-warning border border-warning/20'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">
                      {usagePercent >= 90 
                        ? (language === 'ar' ? 'تحذير: المساحة التخزينية شارفت على النفاد!' : 'Warning: Storage is almost full!')
                        : (language === 'ar' ? 'المساحة التخزينية تقترب من الحد الأقصى' : 'Storage is approaching the limit')}
                    </p>
                    <p className="text-sm opacity-80">
                      {language === 'ar' ? 'قم بترقية خطتك أو حذف بعض الملفات غير المستخدمة.' : 'Consider upgrading your plan or deleting unused files.'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buckets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats?.buckets.map((bucket) => {
              const Icon = getBucketIcon(bucket.id);
              const bucketPercent = stats.total_used > 0 
                ? Math.round((bucket.used / stats.total_used) * 100) 
                : 0;

              return (
                <Card key={bucket.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <Badge variant="outline">{bucketPercent}%</Badge>
                    </div>
                    <h3 className="font-semibold mb-1">
                      {language === 'ar' ? bucket.name_ar : bucket.name}
                    </h3>
                    <p className="text-2xl font-bold text-primary mb-2">
                      {formatBytes(bucket.used)}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderOpen className="w-4 h-4" />
                      <span>{bucket.files_count} {language === 'ar' ? 'ملف' : 'files'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Storage Plans */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'خطط التخزين' : 'Storage Plans'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'قارن بين خطط التخزين المتاحة' : 'Compare available storage plans'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'الخطة' : 'Plan'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المساحة' : 'Storage'}</TableHead>
                    <TableHead>{language === 'ar' ? 'السعر' : 'Price'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storagePlans.map((plan) => {
                    const isCurrentPlan = plan.limit === stats?.storage_limit;
                    return (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{formatBytes(plan.limit)}</TableCell>
                        <TableCell>{plan.price}</TableCell>
                        <TableCell>
                          {isCurrentPlan ? (
                            <Badge className="bg-success">{language === 'ar' ? 'الخطة الحالية' : 'Current'}</Badge>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              {language === 'ar' ? 'ترقية' : 'Upgrade'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
