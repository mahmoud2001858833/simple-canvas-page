import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  ShieldAlert, 
  Monitor, 
  Keyboard, 
  Eye, 
  EyeOff,
  Calendar,
  User,
  Mail,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ScreenCaptureAttempt {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  lesson_id: string | null;
  attempt_type: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export const ScreenCaptureAttempts = () => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [search, setSearch] = useState('');
  const [attemptTypeFilter, setAttemptTypeFilter] = useState<string>('all');

  const { data: attempts, isLoading, refetch } = useQuery({
    queryKey: ['screen-capture-attempts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screen_capture_attempts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ScreenCaptureAttempt[];
    },
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('screen_capture_attempts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting record');
    } else {
      toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
      refetch();
    }
  };

  const handleClearAll = async () => {
    const { error } = await supabase
      .from('screen_capture_attempts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error clearing records');
    } else {
      toast.success(language === 'ar' ? 'تم مسح جميع السجلات' : 'All records cleared');
      refetch();
    }
  };

  const getAttemptTypeLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      'keyboard_shortcut': { ar: 'اختصار لوحة المفاتيح', en: 'Keyboard Shortcut' },
      'window_blur': { ar: 'خروج من النافذة', en: 'Window Blur' },
      'pip_attempt': { ar: 'محاولة صورة في صورة', en: 'Picture-in-Picture' },
      'visibility_change': { ar: 'تغيير الرؤية', en: 'Visibility Change' },
    };
    return labels[type]?.[language] || type;
  };

  const getAttemptTypeIcon = (type: string) => {
    switch (type) {
      case 'keyboard_shortcut':
        return <Keyboard className="w-4 h-4" />;
      case 'window_blur':
        return <EyeOff className="w-4 h-4" />;
      case 'pip_attempt':
        return <Monitor className="w-4 h-4" />;
      case 'visibility_change':
        return <Eye className="w-4 h-4" />;
      default:
        return <ShieldAlert className="w-4 h-4" />;
    }
  };

  const getAttemptTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'keyboard_shortcut':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'window_blur':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'pip_attempt':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'visibility_change':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Get unique attempt types for filter
  const attemptTypes = [...new Set(attempts?.map(a => a.attempt_type) || [])];

  // Filter attempts
  const filteredAttempts = attempts?.filter(attempt => {
    const matchesSearch = 
      (attempt.user_email?.toLowerCase().includes(search.toLowerCase()) ||
       attempt.user_name?.toLowerCase().includes(search.toLowerCase()) ||
       attempt.ip_address?.includes(search));
    
    const matchesType = attemptTypeFilter === 'all' || attempt.attempt_type === attemptTypeFilter;
    
    return matchesSearch && matchesType;
  }) || [];

  // Stats
  const stats = {
    total: attempts?.length || 0,
    keyboard: attempts?.filter(a => a.attempt_type === 'keyboard_shortcut').length || 0,
    blur: attempts?.filter(a => a.attempt_type === 'window_blur').length || 0,
    pip: attempts?.filter(a => a.attempt_type === 'pip_attempt').length || 0,
    visibility: attempts?.filter(a => a.attempt_type === 'visibility_change').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            {language === 'ar' ? 'سجل محاولات التقاط الشاشة' : 'Screen Capture Attempts'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' 
              ? 'مراقبة وتتبع محاولات التقاط الشاشة أثناء مشاهدة الفيديوهات'
              : 'Monitor and track screen capture attempts during video playback'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 me-2" />
            {language === 'ar' ? 'تحديث' : 'Refresh'}
          </Button>
          {attempts && attempts.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'مسح الكل' : 'Clear All'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === 'ar' 
                      ? 'سيتم حذف جميع سجلات محاولات التقاط الشاشة نهائياً.'
                      : 'This will permanently delete all screen capture attempt records.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {language === 'ar' ? 'حذف الكل' : 'Delete All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'إجمالي المحاولات' : 'Total Attempts'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.keyboard}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'اختصارات' : 'Shortcuts'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{stats.blur}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'خروج النافذة' : 'Window Blur'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.pip}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'صورة في صورة' : 'PiP'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.visibility}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'تغيير الرؤية' : 'Visibility'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={language === 'ar' ? 'بحث بالاسم، البريد، أو IP...' : 'Search by name, email, or IP...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-10"
              />
            </div>
            <Select value={attemptTypeFilter} onValueChange={setAttemptTypeFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder={language === 'ar' ? 'نوع المحاولة' : 'Attempt Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === 'ar' ? 'جميع الأنواع' : 'All Types'}
                </SelectItem>
                {attemptTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {getAttemptTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'ar' ? 'سجل المحاولات' : 'Attempts Log'}
            {filteredAttempts.length > 0 && (
              <Badge variant="secondary" className="ms-2">
                {filteredAttempts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="text-center py-12">
              <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                {language === 'ar' ? 'لا توجد محاولات التقاط شاشة' : 'No screen capture attempts found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{language === 'ar' ? 'نوع المحاولة' : 'Type'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}</TableHead>
                    <TableHead>{language === 'ar' ? 'IP' : 'IP Address'}</TableHead>
                    <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">
                              {attempt.user_name || (language === 'ar' ? 'غير معروف' : 'Unknown')}
                            </span>
                          </div>
                          {attempt.user_email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <span>{attempt.user_email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getAttemptTypeBadgeColor(attempt.attempt_type)}>
                          <span className="flex items-center gap-1">
                            {getAttemptTypeIcon(attempt.attempt_type)}
                            {getAttemptTypeLabel(attempt.attempt_type)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>
                            {format(new Date(attempt.created_at), 'PPpp', { 
                              locale: language === 'ar' ? ar : undefined 
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {attempt.ip_address || '-'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {language === 'ar' ? 'حذف السجل' : 'Delete Record'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {language === 'ar' 
                                  ? 'هل تريد حذف هذا السجل؟'
                                  : 'Do you want to delete this record?'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(attempt.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {language === 'ar' ? 'حذف' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
