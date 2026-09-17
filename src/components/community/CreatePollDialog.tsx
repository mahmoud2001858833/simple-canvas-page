import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (question: string, options: string[], isMultiple: boolean) => Promise<void>;
}

export const CreatePollDialog: React.FC<CreatePollDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddOption = () => {
    if (options.length >= 6) {
      toast.warning('الحد الأقصى للخيارات هو 6');
      return;
    }
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.warning('يجب وجود خيارين على الأقل');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (text: string, index: number) => {
    const updated = [...options];
    updated[index] = text;
    setOptions(updated);
  };

  const handleCreate = async () => {
    const trimmedQ = question.trim();
    if (!trimmedQ) {
      toast.error('يرجى كتابة سؤال الاستطلاع');
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      toast.error('يرجى كتابة خيارين صالحين على الأقل');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(trimmedQ, validOptions, isMultiple);
      toast.success('تم نشر الاستطلاع بنجاح');
      setQuestion('');
      setOptions(['', '']);
      setIsMultiple(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل إنشاء الاستطلاع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-white dark:bg-slate-900 text-right" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            إنشاء تصويت / استطلاع رأي للطلاب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              سؤال الاستطلاع <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="مثال: ما هو أفضل موعد للمحاضرة المباشرة القادمة؟"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="text-right text-sm"
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                خيارات التصويت (2 إلى 6 خيارات)
              </Label>
              {options.length < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddOption}
                  className="text-xs text-indigo-600 hover:text-indigo-700 h-7 px-2"
                >
                  <Plus className="w-3.5 h-3.5 ml-1" />
                  إضافة خيار
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 text-xs text-slate-400 font-mono text-center">
                    {idx + 1}.
                  </span>
                  <Input
                    placeholder={`الخيار ${idx + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(e.target.value, idx)}
                    className="text-right text-sm flex-1"
                    dir="rtl"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(idx)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-9 w-9 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                السماح باختيار إجابات متعددة
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                يمكن للطالب اختيار أكثر من خيار في نفس الوقت
              </p>
            </div>
            <Switch checked={isMultiple} onCheckedChange={setIsMultiple} />
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5"
          >
            {loading ? 'جارٍ النشر...' : 'نشر الاستطلاع بالقروب'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
