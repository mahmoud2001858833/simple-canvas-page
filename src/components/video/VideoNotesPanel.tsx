import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StickyNote, Plus, Trash2, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

interface VideoNotesPanelProps {
  lessonId: string;
  currentTime: number;
  onSeek: (seconds: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

const formatTimestamp = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VideoNotesPanel = ({ lessonId, currentTime, onSeek, isOpen, onClose }: VideoNotesPanelProps) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ['video-notes', lessonId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_notes')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('user_id', user!.id)
        .order('timestamp_seconds');
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!lessonId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newNote.trim()) return;
      const { error } = await supabase.from('video_notes').insert({
        user_id: user.id,
        lesson_id: lessonId,
        timestamp_seconds: Math.floor(currentTime),
        note_text: newNote.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote('');
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ['video-notes', lessonId] });
      toast.success(isRTL ? 'تمت إضافة الملاحظة' : 'Note added');
    },
    onError: () => toast.error(isRTL ? 'فشل إضافة الملاحظة' : 'Failed to add note'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('video_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-notes', lessonId] });
      toast.success(isRTL ? 'تم حذف الملاحظة' : 'Note deleted');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="bg-card border rounded-xl shadow-lg w-full max-w-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          {isRTL ? 'ملاحظاتي' : 'My Notes'}
          <span className="text-xs text-muted-foreground">({notes.length})</span>
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isAdding && (
        <div className="p-3 border-b bg-muted/30 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatTimestamp(Math.floor(currentTime))}</span>
          </div>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={isRTL ? 'اكتب ملاحظتك هنا...' : 'Write your note here...'}
            className="min-h-[60px] text-sm resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setNewNote(''); }}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              size="sm"
              onClick={() => addNoteMutation.mutate()}
              disabled={!newNote.trim() || addNoteMutation.isPending}
            >
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[300px]">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
            <StickyNote className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm text-center">
              {isRTL ? 'لا توجد ملاحظات. أضف واحدة!' : 'No notes yet. Add one!'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {notes.map((note: any) => (
              <div
                key={note.id}
                className="group flex gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onSeek(note.timestamp_seconds)}
              >
                <button className="shrink-0 bg-primary/10 text-primary text-xs font-mono px-2 py-1 rounded-md hover:bg-primary/20 transition-colors">
                  {formatTimestamp(note.timestamp_seconds)}
                </button>
                <p className="text-sm flex-1 min-w-0 leading-relaxed">{note.note_text}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteNoteMutation.mutate(note.id); }}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
