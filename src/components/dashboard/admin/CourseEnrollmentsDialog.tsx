import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MoreHorizontal, UserX, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

interface CourseEnrollmentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
}

export const CourseEnrollmentsDialog = ({
  isOpen,
  onClose,
  courseId,
  courseTitle,
}: CourseEnrollmentsDialogProps) => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [expelDialogOpen, setExpelDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['course-enrollments', courseId],
    queryFn: async () => {
      // Fetch enrollments
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('*')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (enrollmentsError) throw enrollmentsError;

      // Fetch user profiles and payments for each enrollment
      const enrichedEnrollments = await Promise.all(
        (enrollmentsData || []).map(async (enrollment) => {
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, full_name_ar, email, phone')
            .eq('id', enrollment.user_id)
            .single();

          // Get payment info
          const { data: payment } = await supabase
            .from('payments')
            .select('amount, status, payment_method, paid_at')
            .eq('course_id', courseId)
            .eq('user_id', enrollment.user_id)
            .eq('status', 'paid')
            .maybeSingle();

          return {
            ...enrollment,
            profile,
            payment,
          };
        })
      );

      return enrichedEnrollments;
    },
    enabled: isOpen && !!courseId,
  });

  const handleExpelFromCourse = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);

    try {
      // Delete enrollment
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('user_id', selectedStudent.id);

      if (error) throw error;

      // Also delete lesson progress for this course
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id')
        .eq('course_id', courseId);

      if (lessons && lessons.length > 0) {
        await supabase
          .from('lesson_progress')
          .delete()
          .eq('user_id', selectedStudent.id)
          .in('lesson_id', lessons.map(l => l.id));
      }

      toast.success(language === 'ar' ? 'تم طرد الطالب من الدورة بنجاح' : 'Student expelled from course successfully');
      queryClient.invalidateQueries({ queryKey: ['course-enrollments', courseId] });
    } catch (error) {
      console.error('Error expelling student:', error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء طرد الطالب' : 'Error expelling student');
    } finally {
      setActionLoading(false);
      setExpelDialogOpen(false);
      setSelectedStudent(null);
    }
  };

  const handleBanFromPlatform = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);

    try {
      // Ban user from platform
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          banned_reason: language === 'ar' ? 'تم الحظر بواسطة المشرف' : 'Banned by administrator',
        })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم حظر الطالب من المنصة بنجاح' : 'Student banned from platform successfully');
      queryClient.invalidateQueries({ queryKey: ['course-enrollments', courseId] });
    } catch (error) {
      console.error('Error banning student:', error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء حظر الطالب' : 'Error banning student');
    } finally {
      setActionLoading(false);
      setBanDialogOpen(false);
      setSelectedStudent(null);
    }
  };

  const getPaymentStatusBadge = (payment: any) => {
    if (!payment) {
      return (
        <Badge variant="destructive">
          {language === 'ar' ? 'غير مدفوع' : 'Not Paid'}
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-500">
        {language === 'ar' ? 'مدفوع' : 'Paid'}
      </Badge>
    );
  };

  const getPaymentMethod = (method: string | null) => {
    if (!method) return '-';
    const methods: Record<string, { ar: string; en: string }> = {
      online: { ar: 'أونلاين', en: 'Online' },
      tabby: { ar: 'تابي', en: 'Tabby' },
      bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
      manual: { ar: 'يدوي', en: 'Manual' },
    };
    return methods[method]?.[language] || method;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {language === 'ar' ? 'الطلاب المسجلين في' : 'Students Enrolled in'}: {courseTitle}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : enrollments && enrollments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead>{language === 'ar' ? 'البريد' : 'Email'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                  <TableHead>{language === 'ar' ? 'تاريخ التسجيل' : 'Enrolled At'}</TableHead>
                  <TableHead>{language === 'ar' ? 'حالة الدفع' : 'Payment'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Method'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enrollment: any) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">
                      {language === 'ar'
                        ? enrollment.profile?.full_name_ar || enrollment.profile?.full_name || '-'
                        : enrollment.profile?.full_name || '-'}
                    </TableCell>
                    <TableCell>{enrollment.profile?.email || '-'}</TableCell>
                    <TableCell dir="ltr">{enrollment.profile?.phone || '-'}</TableCell>
                    <TableCell>
                      {enrollment.enrolled_at
                        ? format(
                            new Date(enrollment.enrolled_at),
                            'yyyy/MM/dd',
                            { locale: language === 'ar' ? ar : undefined }
                          )
                        : '-'}
                    </TableCell>
                    <TableCell>{getPaymentStatusBadge(enrollment.payment)}</TableCell>
                    <TableCell>
                      {enrollment.payment?.amount
                        ? `${enrollment.payment.amount} ${language === 'ar' ? 'ر.س' : 'SAR'}`
                        : '-'}
                    </TableCell>
                    <TableCell>{getPaymentMethod(enrollment.payment?.payment_method)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedStudent({
                                id: enrollment.user_id,
                                name: enrollment.profile?.full_name || enrollment.profile?.email || 'Unknown',
                              });
                              setExpelDialogOpen(true);
                            }}
                            className="text-orange-600"
                          >
                            <UserX className="w-4 h-4 me-2" />
                            {language === 'ar' ? 'طرد من الدورة' : 'Expel from Course'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedStudent({
                                id: enrollment.user_id,
                                name: enrollment.profile?.full_name || enrollment.profile?.email || 'Unknown',
                              });
                              setBanDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Ban className="w-4 h-4 me-2" />
                            {language === 'ar' ? 'حظر من المنصة' : 'Ban from Platform'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{language === 'ar' ? 'لا يوجد طلاب مسجلين' : 'No students enrolled'}</p>
            </div>
          )}

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'إجمالي المسجلين:' : 'Total Enrolled:'}{' '}
              <span className="font-bold text-foreground">{enrollments?.length || 0}</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expel from Course Dialog */}
      <AlertDialog open={expelDialogOpen} onOpenChange={setExpelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'طرد الطالب من الدورة' : 'Expel Student from Course'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد من طرد "${selectedStudent?.name}" من هذه الدورة؟ سيتم إزالة تسجيله وتقدمه في الدروس.`
                : `Are you sure you want to expel "${selectedStudent?.name}" from this course? Their enrollment and lesson progress will be removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExpelFromCourse}
              disabled={actionLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : language === 'ar' ? (
                'طرد من الدورة'
              ) : (
                'Expel from Course'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban from Platform Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {language === 'ar' ? 'حظر الطالب من المنصة' : 'Ban Student from Platform'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد من حظر "${selectedStudent?.name}" من المنصة بالكامل؟ لن يتمكن من تسجيل الدخول أو الوصول لأي محتوى.`
                : `Are you sure you want to ban "${selectedStudent?.name}" from the entire platform? They will not be able to log in or access any content.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBanFromPlatform}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : language === 'ar' ? (
                'حظر من المنصة'
              ) : (
                'Ban from Platform'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
