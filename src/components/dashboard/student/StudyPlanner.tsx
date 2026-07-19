import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, Plus, Clock, BookOpen, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, isSameDay, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

export const StudyPlanner = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '', title_ar: '', course_id: '', duration_minutes: 60, notes: '',
    scheduled_time: '09:00',
  });

  const { data: events = [] } = useQuery({
    queryKey: ['study-planner', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_planner')
        .select('*, courses(title, title_ar)')
        .eq('user_id', user!.id)
        .order('scheduled_date')
        .order('scheduled_time');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: enrolledCourses = [] } = useQuery({
    queryKey: ['enrolled-courses-planner', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('course_id, courses(id, title, title_ar)')
        .eq('user_id', user!.id)
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addEventMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from('study_planner').insert({
        user_id: user.id,
        title: newEvent.title || (isRTL ? 'جلسة مذاكرة' : 'Study Session'),
        title_ar: newEvent.title_ar || newEvent.title,
        course_id: newEvent.course_id || null,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
        scheduled_time: newEvent.scheduled_time,
        duration_minutes: newEvent.duration_minutes,
        notes: newEvent.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-planner'] });
      setShowAddDialog(false);
      setNewEvent({ title: '', title_ar: '', course_id: '', duration_minutes: 60, notes: '', scheduled_time: '09:00' });
      toast.success(isRTL ? 'تمت إضافة الجلسة' : 'Session added');
    },
    onError: () => toast.error(isRTL ? 'فشل الإضافة' : 'Failed to add'),
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('study_planner')
        .update({ is_completed: completed })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['study-planner'] }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('study_planner').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-planner'] });
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    },
  });

  const selectedDateEvents = events.filter((e: any) =>
    isSameDay(parseISO(e.scheduled_date), selectedDate)
  );

  // Dates that have events
  const eventDates = events.map((e: any) => parseISO(e.scheduled_date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" />
          {isRTL ? 'الجدول الدراسي' : 'Study Planner'}
        </h2>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 me-2" />
              {isRTL ? 'إضافة جلسة' : 'Add Session'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'إضافة جلسة مذاكرة' : 'Add Study Session'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder={isRTL ? 'عنوان الجلسة' : 'Session title'}
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
              />
              <Select
                value={newEvent.course_id}
                onValueChange={(val) => setNewEvent(prev => ({ ...prev, course_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر الدورة (اختياري)' : 'Select course (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  {enrolledCourses.map((e: any) => (
                    <SelectItem key={e.course_id} value={e.course_id}>
                      {isRTL ? e.courses?.title_ar : e.courses?.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    {isRTL ? 'الوقت' : 'Time'}
                  </label>
                  <Input
                    type="time"
                    value={newEvent.scheduled_time}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, scheduled_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    {isRTL ? 'المدة (دقيقة)' : 'Duration (min)'}
                  </label>
                  <Input
                    type="number"
                    value={newEvent.duration_minutes}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 60 }))}
                  />
                </div>
              </div>
              <Textarea
                placeholder={isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                value={newEvent.notes}
                onChange={(e) => setNewEvent(prev => ({ ...prev, notes: e.target.value }))}
              />
              <Button className="w-full" onClick={() => addEventMutation.mutate()} disabled={addEventMutation.isPending}>
                {isRTL ? 'إضافة' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={isRTL ? ar : undefined}
              modifiers={{ hasEvent: eventDates }}
              modifiersStyles={{
                hasEvent: { fontWeight: 'bold', textDecoration: 'underline', textDecorationColor: 'hsl(var(--primary))' },
              }}
            />
          </CardContent>
        </Card>

        {/* Events for selected date */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'EEEE, d MMMM', { locale: isRTL ? ar : undefined })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{isRTL ? 'لا توجد جلسات لهذا اليوم' : 'No sessions for this day'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map((event: any) => (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      event.is_completed ? 'bg-muted/30 opacity-70' : 'hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={event.is_completed}
                      onCheckedChange={(checked) =>
                        toggleCompleteMutation.mutate({ id: event.id, completed: !!checked })
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${event.is_completed ? 'line-through' : ''}`}>
                        {isRTL ? (event.title_ar || event.title) : event.title}
                      </p>
                      {event.courses && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          <BookOpen className="w-3 h-3 me-1" />
                          {isRTL ? event.courses.title_ar : event.courses.title}
                        </Badge>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {event.scheduled_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.scheduled_time.slice(0, 5)}
                          </span>
                        )}
                        <span>{event.duration_minutes} {isRTL ? 'دقيقة' : 'min'}</span>
                      </div>
                      {event.notes && <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => deleteEventMutation.mutate(event.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
