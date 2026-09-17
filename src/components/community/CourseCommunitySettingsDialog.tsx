import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Shield, MessageSquare, Image, VolumeX, Users, UserCheck } from 'lucide-react';
import { CommunitySettings, updateCommunitySettings } from '@/services/courseCommunityService';
import { toast } from 'sonner';

interface CourseCommunitySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CommunitySettings;
  courseId: string;
  courseTitle: string;
  currentUserId: string;
  isSuperAdmin?: boolean;
  onSettingsSaved: (newSettings: CommunitySettings) => void;
}

export const CourseCommunitySettingsDialog: React.FC<CourseCommunitySettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  courseId,
  courseTitle,
  currentUserId,
  isSuperAdmin,
  onSettingsSaved,
}) => {
  const [allowMessages, setAllowMessages] = useState(settings.allow_student_messages);
  const [allowMedia, setAllowMedia] = useState(settings.allow_student_media);
  const [isMuted, setIsMuted] = useState(settings.is_chat_muted);
  const [mutedUsers, setMutedUsers] = useState<string[]>(settings.muted_user_ids || []);
  const [saving, setSaving] = useState(false);

  // Sync state when opened
  React.useEffect(() => {
    if (open) {
      setAllowMessages(settings.allow_student_messages);
      setAllowMedia(settings.allow_student_media);
      setIsMuted(settings.is_chat_muted);
      setMutedUsers(settings.muted_user_ids || []);
    }
  }, [open, settings]);

  const handleUnmuteUser = (userId: string) => {
    const updated = mutedUsers.filter((id) => id !== userId);
    setMutedUsers(updated);
    toast.info('سيتم حفظ فك كتم الطالب عند النقر على حفظ الإعدادات');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateCommunitySettings(
        courseId,
        {
          allow_student_messages: allowMessages,
          allow_student_media: allowMedia,
          is_chat_muted: isMuted,
          muted_user_ids: mutedUsers,
        },
        currentUserId
      );

      onSettingsSaved(updated);
      toast.success('تم تحديث إعدادات مجتمع الدورة بنجاح');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full bg-white dark:bg-slate-900 text-right" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            إعدادات وتحكم قروب الدورة {isSuperAdmin && <span className="text-xs bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 rounded-full font-normal">صلاحيات الإدارة العليا</span>}
          </DialogTitle>
          <p className="text-xs text-slate-500 truncate mt-1">
            {courseTitle}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Allow student messages */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  السماح للطلاب بإرسال الرسائل
                </Label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                عند إيقافه، يصبح القروب في وضع الإعلانات ويمنع الطلاب من إرسال أي نص
              </p>
            </div>
            <Switch
              checked={allowMessages}
              onCheckedChange={setAllowMessages}
              disabled={isMuted}
            />
          </div>

          {/* Allow student media */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-blue-600" />
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  السماح برفع الصور والملفات
                </Label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                عند إيقافه، يُسمح للطلاب بالنصوص فقط ويُمنع إرفاق الصور والمستندات
              </p>
            </div>
            <Switch
              checked={allowMedia}
              onCheckedChange={setAllowMedia}
              disabled={isMuted || !allowMessages}
            />
          </div>

          {/* Mute group entirely (Read only / announcement mode) */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-amber-600" />
                <Label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  قفل الشات مؤقتاً (وضع الإعلانات فقط)
                </Label>
              </div>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                يقفل الشات بالكامل على الطلاب بحيث يستطيع المعلم والإدارة فقط النشر
              </p>
            </div>
            <Switch
              checked={isMuted}
              onCheckedChange={setIsMuted}
            />
          </div>

          {/* Muted Students Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                الطلاب المكتومون في هذا القروب ({mutedUsers.length})
              </Label>
            </div>

            {mutedUsers.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded text-center">
                لا يوجد طلاب مكتومون حالياً في هذه الدورة.
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1.5 p-1">
                {mutedUsers.map((uid) => (
                  <div
                    key={uid}
                    className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs"
                  >
                    <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[220px]">
                      معرف الطالب: {uid.slice(0, 10)}...
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnmuteUser(uid)}
                      className="h-6 text-[11px] px-2 text-emerald-600 hover:text-emerald-700 border-emerald-200"
                    >
                      <UserCheck className="w-3 h-3 ml-1" />
                      إلغاء الكتم
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
