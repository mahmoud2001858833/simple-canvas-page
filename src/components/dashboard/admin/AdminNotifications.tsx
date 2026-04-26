import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bell, Send, Users, User, Megaphone, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ListSkeleton } from '@/components/ui/skeletons';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export const AdminNotifications = () => {
  const { language, dir } = useLanguage();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState<'all' | 'role' | 'user'>('all');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [message, setMessage] = useState('');
  const [messageAr, setMessageAr] = useState('');
  const [notificationType, setNotificationType] = useState<string>('info');

  // Fetch recent notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch users for targeting
  const { data: users } = useQuery({
    queryKey: ['users-for-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      return data;
    },
  });

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      let targetUsers: string[] = [];

      if (targetType === 'all') {
        const { data } = await supabase.from('profiles').select('id');
        targetUsers = data?.map((u: any) => u.id) || [];
      } else if (targetType === 'role' && selectedRole) {
        const { data } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', selectedRole as 'student' | 'instructor' | 'admin' | 'secretary' | 'production');
        targetUsers = data?.map((u: any) => u.user_id) || [];
      } else if (targetType === 'user' && selectedUserId) {
        targetUsers = [selectedUserId];
      }

      if (targetUsers.length === 0) {
        throw new Error('No target users found');
      }

      const notificationsToInsert = targetUsers.map((userId) => ({
        user_id: userId,
        title,
        title_ar: titleAr,
        message,
        message_ar: messageAr,
        type: notificationType,
        is_read: false,
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (error) throw error;
      return targetUsers.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success(
        language === 'ar' 
          ? `تم إرسال الإشعار إلى ${count} مستخدم` 
          : `Notification sent to ${count} users`
      );
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || (language === 'ar' ? 'فشل إرسال الإشعار' : 'Failed to send notification'));
    },
  });

  const resetForm = () => {
    setTitle('');
    setTitleAr('');
    setMessage('');
    setMessageAr('');
    setTargetType('all');
    setSelectedRole('');
    setSelectedUserId('');
    setNotificationType('info');
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      info: 'bg-blue-500/10 text-blue-600',
      success: 'bg-green-500/10 text-green-600',
      warning: 'bg-yellow-500/10 text-yellow-600',
      error: 'bg-red-500/10 text-red-600',
    };
    return styles[type] || styles.info;
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {language === 'ar' ? 'إدارة الإشعارات' : 'Notifications Management'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'إرسال وإدارة إشعارات المستخدمين' : 'Send and manage user notifications'}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {language === 'ar' ? 'إرسال إشعار' : 'Send Notification'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5" />
                {language === 'ar' ? 'إرسال إشعار جديد' : 'Send New Notification'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'أرسل إشعار للمستخدمين' : 'Send a notification to users'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Target Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'ar' ? 'الهدف' : 'Target'}
                </label>
                <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {language === 'ar' ? 'جميع المستخدمين' : 'All Users'}
                      </span>
                    </SelectItem>
                    <SelectItem value="role">
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {language === 'ar' ? 'حسب الدور' : 'By Role'}
                      </span>
                    </SelectItem>
                    <SelectItem value="user">
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {language === 'ar' ? 'مستخدم محدد' : 'Specific User'}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === 'role' && (
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الدور' : 'Select Role'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">{language === 'ar' ? 'طالب' : 'Student'}</SelectItem>
                    <SelectItem value="instructor">{language === 'ar' ? 'مدرس' : 'Instructor'}</SelectItem>
                    <SelectItem value="admin">{language === 'ar' ? 'مشرف' : 'Admin'}</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {targetType === 'user' && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر المستخدم' : 'Select User'} />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Notification Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'ar' ? 'نوع الإشعار' : 'Notification Type'}
                </label>
                <Select value={notificationType} onValueChange={setNotificationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">{language === 'ar' ? 'معلومات' : 'Info'}</SelectItem>
                    <SelectItem value="success">{language === 'ar' ? 'نجاح' : 'Success'}</SelectItem>
                    <SelectItem value="warning">{language === 'ar' ? 'تحذير' : 'Warning'}</SelectItem>
                    <SelectItem value="error">{language === 'ar' ? 'خطأ' : 'Error'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === 'ar' ? 'العنوان (إنجليزي)' : 'Title (English)'}
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Notification title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'}
                  </label>
                  <Input
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    placeholder="عنوان الإشعار"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === 'ar' ? 'الرسالة (إنجليزي)' : 'Message (English)'}
                  </label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Notification message"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === 'ar' ? 'الرسالة (عربي)' : 'Message (Arabic)'}
                  </label>
                  <Textarea
                    value={messageAr}
                    onChange={(e) => setMessageAr(e.target.value)}
                    placeholder="نص الإشعار"
                    dir="rtl"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={() => sendNotificationMutation.mutate()}
                disabled={!title || !message || sendNotificationMutation.isPending}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {sendNotificationMutation.isPending
                  ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...')
                  : (language === 'ar' ? 'إرسال' : 'Send')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recent Notifications */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {language === 'ar' ? 'الإشعارات الأخيرة' : 'Recent Notifications'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' ? 'آخر 50 إشعار تم إرسالها' : 'Last 50 sent notifications'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : notifications?.length ? (
            <div className="space-y-3">
              {notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTypeBadge(notification.type)}`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">
                        {language === 'ar' ? notification.title_ar || notification.title : notification.title}
                      </p>
                      <Badge variant="outline" className={getTypeBadge(notification.type)}>
                        {notification.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {language === 'ar' ? notification.message_ar || notification.message : notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{notification.profiles?.full_name || notification.profiles?.email || 'Unknown'}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(notification.created_at), 'PPp', {
                          locale: language === 'ar' ? ar : undefined,
                        })}
                      </span>
                      {notification.is_read && (
                        <Badge variant="secondary" className="text-xs">
                          {language === 'ar' ? 'مقروء' : 'Read'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
