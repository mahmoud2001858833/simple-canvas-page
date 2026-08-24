import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Camera, Loader2, Lock, Mail, User as UserIcon, Phone, Settings } from 'lucide-react';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings?: () => void;
}

export const ProfileDialog = ({ open, onOpenChange, onOpenSettings }: ProfileDialogProps) => {
  const { language } = useLanguage();
  const { user, profile, role, refreshProfile } = useAuth();
  const isRTL = language === 'ar';
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(profile?.full_name || '');
      setPhone(profile?.phone || '');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, profile]);

  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const canEditInfo = role !== 'student';

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'الرجاء اختيار صورة' : 'Please select an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-images')
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: pub.publicUrl })
        .eq('id', user.id);
      if (dbErr) throw dbErr;

      await refreshProfile();
      toast.success(isRTL ? 'تم تحديث الصورة الشخصية' : 'Profile picture updated');
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? 'فشل تحديث الصورة' : 'Failed to update picture'));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!user) return;
    setSavingInfo(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(isRTL ? 'تم حفظ البيانات' : 'Details saved');
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      toast.success(isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? 'فشل تغيير كلمة المرور' : 'Failed to change password'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{isRTL ? 'الملف الشخصي' : 'My Profile'}</DialogTitle>
          <DialogDescription>
            {isRTL ? 'إدارة بياناتك وصورتك وكلمة المرور' : 'Manage your details, picture and password'}
          </DialogDescription>
        </DialogHeader>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20 ring-2 ring-primary/30">
              <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || ''} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -end-1 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-60"
              aria-label={isRTL ? 'تغيير الصورة' : 'Change picture'}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarUpload(f);
                e.target.value = '';
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{profile?.full_name || (isRTL ? 'مستخدم' : 'User')}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {profile?.email || user?.email}
            </p>
          </div>
        </div>

        <Separator />

        {/* Info */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <UserIcon className="w-3.5 h-3.5" />
              {isRTL ? 'الاسم الكامل' : 'Full name'}
            </Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!canEditInfo} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Phone className="w-3.5 h-3.5" />
              {isRTL ? 'رقم الجوال' : 'Phone'}
            </Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEditInfo} dir="ltr" />
          </div>
          {canEditInfo ? (
            <Button onClick={handleSaveInfo} disabled={savingInfo} className="w-full">
              {savingInfo && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isRTL ? 'حفظ البيانات' : 'Save details'}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? 'لا يمكنك تعديل بياناتك الشخصية. تواصل مع الإدارة للتعديل.'
                : 'You cannot edit your personal data. Contact admin for changes.'}
            </p>
          )}
        </div>

        <Separator />

        {/* Password */}
        <div className="space-y-3">
          <p className="font-medium text-sm flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            {isRTL ? 'تغيير كلمة المرور' : 'Change password'}
          </p>
          <Input
            type="password"
            placeholder={isRTL ? 'كلمة المرور الجديدة' : 'New password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder={isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button variant="outline" onClick={handleChangePassword} disabled={savingPassword} className="w-full">
            {savingPassword && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {isRTL ? 'تحديث كلمة المرور' : 'Update password'}
          </Button>
        </div>

        {onOpenSettings && (
          <>
            <Separator />
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => {
                onOpenChange(false);
                onOpenSettings();
              }}
            >
              <Settings className="w-4 h-4" />
              {isRTL ? 'إعدادات إضافية' : 'More settings'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
