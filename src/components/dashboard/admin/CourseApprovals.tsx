import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Clock, BookOpen, User } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  price: number | null;
  duration_hours: number | null;
  approval_status: string | null;
  rejection_reason: string | null;
  created_at: string;
  instructor_id: string | null;
  instructor_commission?: number | null;
  instructor?: {
    full_name: string | null;
    email: string | null;
  };
}

export const CourseApprovals = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [commissionRate, setCommissionRate] = useState('70');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  const { data: courses, isLoading } = useQuery({
    queryKey: ['pending-courses', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('approval_status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch instructor info for each course
      const enrichedCourses = await Promise.all(
        (data || []).map(async (course) => {
          if (course.instructor_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', course.instructor_id)
              .single();
            return { ...course, instructor: profile };
          }
          return { ...course, instructor: null };
        })
      );

      return enrichedCourses as Course[];
    },
  });

  const handleApprove = async (course: Course) => {
    const commission = Number(commissionRate);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      toast.error(language === 'ar' ? 'أدخل نسبة معلم صحيحة بين 0 و 100' : 'Enter a valid commission between 0 and 100');
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          approval_status: 'approved',
          is_approved: true,
          is_active: true,
          instructor_commission: commission,
        })
        .eq('id', course.id);

      if (error) throw error;

      // Send notification to instructor
      if (course.instructor_id) {
        await supabase.from('notifications').insert({
          user_id: course.instructor_id,
          title: 'Course Approved',
          title_ar: 'تمت الموافقة على الدورة',
          message: `Your course "${course.title}" has been approved and is now live.`,
          message_ar: `تمت الموافقة على دورتك "${course.title_ar}" وهو الآن متاح.`,
          type: 'success',
          link: '/instructor',
        });

        // Send email notification
        const { data: instructorProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', course.instructor_id)
          .single();

        if (instructorProfile?.email) {
          supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'course_approved',
              to_email: instructorProfile.email,
              to_name: instructorProfile.full_name || '',
              course_title: course.title,
              course_title_ar: course.title_ar,
            },
          }).catch(console.error);
        }
      }

      toast.success(language === 'ar' ? 'تمت الموافقة على الدورة' : 'Course approved successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-courses'] });
    } catch (error) {
      console.error('Error approving course:', error);
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedCourse) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('courses')
        .update({
          approval_status: 'rejected',
          is_approved: false,
          is_active: false,
          rejection_reason: rejectionReason,
        })
        .eq('id', selectedCourse.id);

      if (error) throw error;

      // Send notification to instructor
      if (selectedCourse.instructor_id) {
        await supabase.from('notifications').insert({
          user_id: selectedCourse.instructor_id,
          title: 'Course Rejected',
          title_ar: 'تم رفض الدورة',
          message: `Your course "${selectedCourse.title}" was rejected. Reason: ${rejectionReason}`,
          message_ar: `تم رفض دورتك "${selectedCourse.title_ar}". السبب: ${rejectionReason}`,
          type: 'warning',
          link: '/instructor',
        });

        // Send email notification
        const { data: instructorProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', selectedCourse.instructor_id)
          .single();

        if (instructorProfile?.email) {
          supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'course_rejected',
              to_email: instructorProfile.email,
              to_name: instructorProfile.full_name || '',
              course_title: selectedCourse.title,
              course_title_ar: selectedCourse.title_ar,
              rejection_reason: rejectionReason,
            },
          }).catch(console.error);
        }
      }

      toast.success(language === 'ar' ? 'تم رفض الدورة' : 'Course rejected');
      queryClient.invalidateQueries({ queryKey: ['pending-courses'] });
      setRejectDialogOpen(false);
      setSelectedCourse(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting course:', error);
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-600 dark:bg-emerald-500">
            <CheckCircle className="w-3 h-3 me-1" />
            {language === 'ar' ? 'موافق عليه' : 'Approved'}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 me-1" />
            {language === 'ar' ? 'مرفوض' : 'Rejected'}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="w-3 h-3 me-1" />
            {language === 'ar' ? 'في انتظار الموافقة' : 'Pending'}
          </Badge>
        );
    }
  };

  const pendingCount = courses?.filter(c => c.approval_status === 'pending').length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {language === 'ar' ? 'موافقة على دورات المعلم' : 'Instructor Course Approvals'}
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ms-2">
                {pendingCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('pending')}
            >
              {language === 'ar' ? 'في الانتظار' : 'Pending'}
            </Button>
            <Button
              variant={filterStatus === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('approved')}
            >
              {language === 'ar' ? 'موافق عليها' : 'Approved'}
            </Button>
            <Button
              variant={filterStatus === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('rejected')}
            >
              {language === 'ar' ? 'مرفوضة' : 'Rejected'}
            </Button>
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              {language === 'ar' ? 'الكل' : 'All'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الدورة' : 'Course'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المعلم' : 'Instructor'}</TableHead>
                  <TableHead>{language === 'ar' ? 'السعر' : 'Price'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المدة' : 'Duration'}</TableHead>
                  <TableHead>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {language === 'ar' ? course.title_ar : course.title}
                        </p>
                        {course.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {language === 'ar' ? course.description : course.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{course.instructor?.full_name || course.instructor?.email || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {course.price || 0} {language === 'ar' ? 'ر.س' : 'SAR'}
                    </TableCell>
                    <TableCell>
                      {course.duration_hours || 0} {language === 'ar' ? 'ساعة' : 'hrs'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(course.created_at), 'yyyy/MM/dd', {
                        locale: language === 'ar' ? ar : undefined,
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(course.approval_status)}</TableCell>
                    <TableCell>
                      {course.approval_status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(course)}
                            disabled={actionLoading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle className="w-4 h-4 me-1" />
                            {language === 'ar' ? 'موافقة' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedCourse(course);
                              setRejectDialogOpen(true);
                            }}
                            disabled={actionLoading}
                          >
                            <XCircle className="w-4 h-4 me-1" />
                            {language === 'ar' ? 'رفض' : 'Reject'}
                          </Button>
                        </div>
                      )}
                      {course.approval_status === 'rejected' && course.rejection_reason && (
                        <p className="text-sm text-destructive">
                          {language === 'ar' ? 'السبب:' : 'Reason:'} {course.rejection_reason}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{language === 'ar' ? 'لا توجد دورات' : 'No courses found'}</p>
          </div>
        )}
      </CardContent>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'رفض الدورة' : 'Reject Course'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {language === 'ar'
                ? `هل أنت متأكد من رفض دورة "${selectedCourse?.title_ar}"؟`
                : `Are you sure you want to reject "${selectedCourse?.title}"?`}
            </p>
            <div>
              <label className="text-sm font-medium">
                {language === 'ar' ? 'سبب الرفض' : 'Rejection Reason'}
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب سبب الرفض...' : 'Enter rejection reason...'}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : language === 'ar' ? (
                  'رفض الدورة'
                ) : (
                  'Reject Course'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};