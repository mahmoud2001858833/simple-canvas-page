import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Search, UserCog, Shield, Ban, Trash2, RefreshCw, Loader2, Smartphone, UserPlus } from 'lucide-react';
import { UsersTableSkeleton } from '@/components/ui/skeletons';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

type UserRole = 'student' | 'instructor' | 'secretary' | 'production' | 'admin';

export const UsersManagement = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [bannedFilter, setBannedFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Ban dialog state
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [userToBan, setUserToBan] = useState<any>(null);
  const [banReason, setBanReason] = useState('');
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  // Reset device dialog
  const [resetDeviceDialogOpen, setResetDeviceDialogOpen] = useState(false);
  const [userToResetDevice, setUserToResetDevice] = useState<any>(null);

  // Add user dialog state
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('student');
  const [isAddingUser, setIsAddingUser] = useState(false);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users', search, roleFilter, bannedFilter],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_profiles_fkey(role)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      let filteredData = data || [];

      // Filter by role if specified
      if (roleFilter !== 'all') {
        filteredData = filteredData.filter((u: any) => 
          u.user_roles?.some((r: any) => r.role === roleFilter)
        );
      }

      // Filter by banned status
      if (bannedFilter === 'banned') {
        filteredData = filteredData.filter((u: any) => u.is_banned === true);
      } else if (bannedFilter === 'active') {
        filteredData = filteredData.filter((u: any) => !u.is_banned);
      }

      return filteredData;
    },
  });

  if (error) {
    console.error('Query error:', error);
  }

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(language === 'ar' ? 'تم تحديث الدور بنجاح' : 'Role updated successfully');
      setSelectedUser(null);
    },
    onError: () => {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, isBanned, reason }: { userId: string; isBanned: boolean; reason?: string }) => {
      const updateData: any = {
        is_banned: isBanned,
        banned_at: isBanned ? new Date().toISOString() : null,
        banned_reason: isBanned ? reason : null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      // If banning, also deactivate all device sessions
      if (isBanned) {
        await supabase
          .from('device_sessions')
          .update({ is_active: false })
          .eq('user_id', userId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        variables.isBanned 
          ? (language === 'ar' ? 'تم حظر المستخدم بنجاح' : 'User banned successfully')
          : (language === 'ar' ? 'تم إلغاء حظر المستخدم' : 'User unbanned successfully')
      );
      setBanDialogOpen(false);
      setUserToBan(null);
      setBanReason('');
    },
    onError: () => {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Full delete: cascades public data AND removes auth.users so the user cannot log in again
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { target_user_id: userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(language === 'ar' ? 'تم حذف المستخدم بالكامل' : 'User fully deleted');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error((language === 'ar' ? 'فشل حذف المستخدم: ' : 'Failed to delete user: ') + (error?.message || ''));
    },
  });

  const resetDeviceMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('reset_user_device', {
        target_user_id: userId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إعادة تعيين الجهاز بنجاح' : 'Device reset successfully');
      setResetDeviceDialogOpen(false);
      setUserToResetDevice(null);
    },
    onError: (error) => {
      console.error('Reset device error:', error);
      toast.error(language === 'ar' ? 'فشل إعادة تعيين الجهاز' : 'Failed to reset device');
    },
  });

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-destructive text-destructive-foreground',
      instructor: 'bg-primary text-primary-foreground',
      student: 'bg-secondary text-secondary-foreground',
      secretary: 'bg-accent text-accent-foreground',
      production: 'bg-warning text-warning-foreground',
    };
    
    const labels: Record<string, { ar: string; en: string }> = {
      admin: { ar: 'مشرف', en: 'Admin' },
      instructor: { ar: 'مدرس', en: 'Instructor' },
      student: { ar: 'طالب', en: 'Student' },
      secretary: { ar: 'سكرتارية', en: 'Secretary' },
      production: { ar: 'إنتاج', en: 'Production' },
    };

    return (
      <Badge className={colors[role] || 'bg-muted'}>
        {labels[role]?.[language] || role}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserFullName) {
      toast.error(language === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
      return;
    }

    setIsAddingUser(true);
    try {
      // Create user using Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserFullName,
            role: newUserRole,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Update the role if not student (student is default)
        if (newUserRole !== 'student') {
          await supabase
            .from('user_roles')
            .update({ role: newUserRole })
            .eq('user_id', data.user.id);
        }
      }

      toast.success(language === 'ar' ? 'تم إضافة المستخدم بنجاح' : 'User added successfully');
      setAddUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setNewUserRole('student');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.message || (language === 'ar' ? 'فشل إضافة المستخدم' : 'Failed to add user'));
    } finally {
      setIsAddingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {language === 'ar' ? 'إدارة المستخدمين' : 'Users Management'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'إدارة حسابات المستخدمين وأدوارهم' : 'Manage user accounts and roles'}
          </p>
        </div>
        <Button onClick={() => setAddUserDialogOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={language === 'ar' ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder={language === 'ar' ? 'تصفية حسب الدور' : 'Filter by role'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
            <SelectItem value="student">{language === 'ar' ? 'طالب' : 'Student'}</SelectItem>
            <SelectItem value="instructor">{language === 'ar' ? 'مدرس' : 'Instructor'}</SelectItem>
            <SelectItem value="secretary">{language === 'ar' ? 'سكرتارية' : 'Secretary'}</SelectItem>
            <SelectItem value="production">{language === 'ar' ? 'إنتاج' : 'Production'}</SelectItem>
            <SelectItem value="admin">{language === 'ar' ? 'مشرف' : 'Admin'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bannedFilter} onValueChange={setBannedFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder={language === 'ar' ? 'حالة الحساب' : 'Account status'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
            <SelectItem value="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
            <SelectItem value="banned">{language === 'ar' ? 'محظور' : 'Banned'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <UsersTableSkeleton rows={6} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                <TableHead>{language === 'ar' ? 'البريد' : 'Email'}</TableHead>
                <TableHead>{language === 'ar' ? 'الدور' : 'Role'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'تاريخ التسجيل' : 'Joined'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(user.full_name || user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.full_name || '-'}</div>
                        <div className="text-sm text-muted-foreground">{user.phone || '-'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.user_roles?.[0]?.role && getRoleBadge(user.user_roles[0].role)}
                  </TableCell>
                  <TableCell>
                    {user.is_banned ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <Ban className="w-3 h-3" />
                        {language === 'ar' ? 'محظور' : 'Banned'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                        {language === 'ar' ? 'نشط' : 'Active'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), 'd MMM yyyy', {
                      locale: language === 'ar' ? ar : enUS,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Edit Role */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedUser(user)}
                            title={language === 'ar' ? 'تعديل الدور' : 'Edit role'}
                          >
                            <UserCog className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Shield className="w-5 h-5" />
                              {language === 'ar' ? 'تعديل دور المستخدم' : 'Edit User Role'}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={user.avatar_url || ''} />
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {getInitials(user.full_name || user.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.full_name}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                {language === 'ar' ? 'الدور الجديد' : 'New Role'}
                              </label>
                              <Select
                                defaultValue={user.user_roles?.[0]?.role || 'student'}
                                onValueChange={(value) => {
                                  updateRoleMutation.mutate({
                                    userId: user.id,
                                    newRole: value as UserRole,
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="student">{language === 'ar' ? 'طالب' : 'Student'}</SelectItem>
                                  <SelectItem value="instructor">{language === 'ar' ? 'مدرس' : 'Instructor'}</SelectItem>
                                  <SelectItem value="secretary">{language === 'ar' ? 'سكرتارية' : 'Secretary'}</SelectItem>
                                  <SelectItem value="production">{language === 'ar' ? 'إنتاج' : 'Production'}</SelectItem>
                                  <SelectItem value="admin">{language === 'ar' ? 'مشرف' : 'Admin'}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Reset Device */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setUserToResetDevice(user);
                          setResetDeviceDialogOpen(true);
                        }}
                        title={language === 'ar' ? 'إعادة تعيين الجهاز' : 'Reset device'}
                      >
                        <Smartphone className="w-4 h-4" />
                      </Button>

                      {/* Ban/Unban */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (user.is_banned) {
                            banUserMutation.mutate({ userId: user.id, isBanned: false });
                          } else {
                            setUserToBan(user);
                            setBanDialogOpen(true);
                          }
                        }}
                        title={user.is_banned 
                          ? (language === 'ar' ? 'إلغاء الحظر' : 'Unban')
                          : (language === 'ar' ? 'حظر' : 'Ban')}
                        className={user.is_banned ? 'text-green-600 hover:text-green-700' : 'text-amber-600 hover:text-amber-700'}
                      >
                        {user.is_banned ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                        title={language === 'ar' ? 'حذف نهائي' : 'Delete permanently'}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Ban Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-amber-600" />
              {language === 'ar' ? 'حظر المستخدم' : 'Ban User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد من حظر "${userToBan?.full_name || userToBan?.email}"؟ لن يتمكن من تسجيل الدخول.`
                : `Are you sure you want to ban "${userToBan?.full_name || userToBan?.email}"? They won't be able to log in.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>{language === 'ar' ? 'سبب الحظر (اختياري)' : 'Ban reason (optional)'}</Label>
            <Textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder={language === 'ar' ? 'أدخل سبب الحظر...' : 'Enter ban reason...'}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setBanDialogOpen(false);
              setUserToBan(null);
              setBanReason('');
            }}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => userToBan && banUserMutation.mutate({ 
                userId: userToBan.id, 
                isBanned: true, 
                reason: banReason 
              })}
              disabled={banUserMutation.isPending}
            >
              {banUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {language === 'ar' ? 'حظر' : 'Ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              {language === 'ar' ? 'حذف المستخدم نهائياً' : 'Delete User Permanently'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد من حذف "${userToDelete?.full_name || userToDelete?.email}" نهائياً؟ سيتم حذف جميع بياناته بما في ذلك التسجيلات والشهادات والمدفوعات. هذا الإجراء لا يمكن التراجع عنه!`
                : `Are you sure you want to permanently delete "${userToDelete?.full_name || userToDelete?.email}"? All their data including enrollments, certificates, and payments will be deleted. This action cannot be undone!`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setUserToDelete(null);
            }}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {language === 'ar' ? 'حذف نهائي' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Device Dialog */}
      <AlertDialog open={resetDeviceDialogOpen} onOpenChange={setResetDeviceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'إعادة تعيين الجهاز' : 'Reset Device'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد من إعادة تعيين جهاز "${userToResetDevice?.full_name || userToResetDevice?.email}"؟ سيتمكن من تسجيل الدخول من جهاز جديد.`
                : `Are you sure you want to reset the device for "${userToResetDevice?.full_name || userToResetDevice?.email}"? They will be able to log in from a new device.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setResetDeviceDialogOpen(false);
              setUserToResetDevice(null);
            }}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToResetDevice && resetDeviceMutation.mutate(userToResetDevice.id)}
              disabled={resetDeviceMutation.isPending}
            >
              {resetDeviceMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الاسم الكامل' : 'Full Name'}</Label>
              <Input
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل الاسم...' : 'Enter name...'}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'كلمة المرور' : 'Password'}</Label>
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل كلمة المرور...' : 'Enter password...'}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الدور' : 'Role'}</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">{language === 'ar' ? 'طالب' : 'Student'}</SelectItem>
                  <SelectItem value="instructor">{language === 'ar' ? 'مدرس' : 'Instructor'}</SelectItem>
                  <SelectItem value="secretary">{language === 'ar' ? 'سكرتارية' : 'Secretary'}</SelectItem>
                  <SelectItem value="production">{language === 'ar' ? 'إنتاج' : 'Production'}</SelectItem>
                  <SelectItem value="admin">{language === 'ar' ? 'مشرف' : 'Admin'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddUser} disabled={isAddingUser} className="w-full gap-2">
              {isAddingUser ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {language === 'ar' ? 'إضافة المستخدم' : 'Add User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
