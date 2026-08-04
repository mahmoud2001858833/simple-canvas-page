import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CloudUpload, RotateCcw, Loader2, Database, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const FinancialControls = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();

  const [label, setLabel] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: backups } = useQuery({
    queryKey: ['financial-backups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_backups')
        .select('id, label, payments_count, earnings_count, total_revenue, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const { error } = await supabase.rpc('create_financial_backup', {
        p_label: label || undefined,
      });
      if (error) throw error;
      setLabel('');
      await queryClient.invalidateQueries({ queryKey: ['financial-backups'] });
      toast.success(isRTL ? 'تم إنشاء نسخة احتياطية مالية' : 'Financial backup created');
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? 'فشل إنشاء النسخة الاحتياطية' : 'Backup failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const { error } = await supabase.rpc('reset_financial_data', { p_backup_first: true });
      if (error) throw error;
      await queryClient.invalidateQueries();
      toast.success(isRTL ? 'تم تصفير البيانات المالية بعد حفظ نسخة احتياطية' : 'Financial data reset (backup saved)');
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? 'فشل التصفير' : 'Reset failed');
    } finally {
      setIsResetting(false);
      setConfirmOpen(false);
    }
  };

  const downloadBackup = async (id: string, backupLabel: string | null) => {
    try {
      const { data, error } = await supabase
        .from('financial_backups')
        .select('snapshot')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data?.snapshot ?? {}, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backupLabel || 'financial-backup'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? 'فشل التنزيل' : 'Download failed');
    }
  };

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          {isRTL ? 'البيانات المالية' : 'Financial Data'}
        </CardTitle>
        <CardDescription>
          {isRTL
            ? 'إنشاء نسخة سحابية من البيانات المالية أو تصفيرها والبدء من الصفر'
            : 'Create a cloud backup of financial data or reset it and start fresh'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{isRTL ? 'اسم النسخة (اختياري)' : 'Backup label (optional)'}</Label>
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={isRTL ? 'نسخة نهاية الشهر' : 'End of month snapshot'}
            />
            <Button onClick={handleBackup} disabled={isBackingUp} className="gap-2 shrink-0">
              {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              {isRTL ? 'تخزين سحابي' : 'Backup'}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between p-4 rounded-xl border border-destructive/40">
          <div>
            <p className="font-medium text-destructive">
              {isRTL ? 'تصفير البيانات المالية' : 'Reset financial data'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? 'حذف المدفوعات والأرباح والسحوبات والأقساط (يتم حفظ نسخة تلقائياً قبل التصفير)'
                : 'Deletes payments, earnings, withdrawals and installments (an automatic backup is saved first)'}
            </p>
          </div>
          <Button variant="destructive" className="gap-2 shrink-0" onClick={() => setConfirmOpen(true)}>
            <RotateCcw className="w-4 h-4" />
            {isRTL ? 'تصفير' : 'Reset'}
          </Button>
        </div>

        {!!backups?.length && (
          <div className="space-y-2">
            <Label>{isRTL ? 'النسخ المحفوظة' : 'Saved backups'}</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(b.created_at).toLocaleString(isRTL ? 'ar' : 'en')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">
                      {Number(b.total_revenue).toLocaleString()} {isRTL ? 'ر.س' : 'SAR'}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => downloadBackup(b.id, b.label)}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'تأكيد تصفير البيانات المالية' : 'Confirm financial reset'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? 'سيتم حذف جميع المدفوعات وأرباح المعلمين والسحوبات واستخدام الكوبونات. لا يمكن التراجع إلا عبر النسخة الاحتياطية.'
                : 'All payments, instructor earnings, withdrawals and coupon usage will be deleted. Recovery is only possible via the backup.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReset(); }}
              disabled={isResetting}
            >
              {isResetting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isRTL ? 'تصفير الآن' : 'Reset now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
