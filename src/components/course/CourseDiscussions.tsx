import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageSquare, Plus, Pin, Lock, Send, ArrowLeft } from 'lucide-react';

interface Props {
  courseId: string;
  isInstructor?: boolean;
}

export const CourseDiscussions = ({ courseId, isInstructor }: Props) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isAr = language === 'ar';
  const [newPostDialog, setNewPostDialog] = useState(false);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [replyContent, setReplyContent] = useState('');

  const { data: discussions, isLoading } = useQuery({
    queryKey: ['course-discussions', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_discussions')
        .select('*, profiles:user_id(full_name, full_name_ar)')
        .eq('course_id', courseId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: replies } = useQuery({
    queryKey: ['discussion-replies', selectedThread?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussion_replies')
        .select('*, profiles:user_id(full_name, full_name_ar)')
        .eq('discussion_id', selectedThread.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedThread?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_discussions').insert({
        course_id: courseId,
        user_id: user!.id,
        title,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-discussions'] });
      toast.success(isAr ? 'تم إنشاء الموضوع' : 'Discussion created');
      setNewPostDialog(false);
      setTitle('');
      setContent('');
    },
    onError: () => toast.error(isAr ? 'حدث خطأ' : 'Failed to create'),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('discussion_replies').insert({
        discussion_id: selectedThread.id,
        user_id: user!.id,
        content: replyContent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussion-replies'] });
      queryClient.invalidateQueries({ queryKey: ['course-discussions'] });
      setReplyContent('');
    },
    onError: () => toast.error(isAr ? 'حدث خطأ' : 'Failed to reply'),
  });

  const togglePin = useMutation({
    mutationFn: async (discussion: any) => {
      const { error } = await supabase.from('course_discussions')
        .update({ is_pinned: !discussion.is_pinned })
        .eq('id', discussion.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-discussions'] }),
  });

  const toggleLock = useMutation({
    mutationFn: async (discussion: any) => {
      const { error } = await supabase.from('course_discussions')
        .update({ is_locked: !discussion.is_locked })
        .eq('id', discussion.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-discussions'] }),
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>;
  }

  // Thread detail view
  if (selectedThread) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
          <ArrowLeft className="w-4 h-4 me-2" />
          {isAr ? 'العودة' : 'Back'}
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{((selectedThread.profiles as any)?.full_name || '?')[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg">{selectedThread.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {isAr ? (selectedThread.profiles as any)?.full_name_ar : (selectedThread.profiles as any)?.full_name}
                  {' • '}
                  {format(new Date(selectedThread.created_at), 'PP', { locale: isAr ? ar : undefined })}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{selectedThread.content}</p>
          </CardContent>
        </Card>

        <Separator />

        <div className="space-y-3">
          {replies?.map((reply: any) => (
            <Card key={reply.id} className={reply.is_answer ? 'border-green-500/50 bg-green-500/5' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{((reply.profiles as any)?.full_name || '?')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {isAr ? (reply.profiles as any)?.full_name_ar : (reply.profiles as any)?.full_name}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reply.created_at), 'PP', { locale: isAr ? ar : undefined })}
                      </span>
                      {reply.is_answer && <Badge variant="outline" className="text-green-600 border-green-600">{isAr ? 'إجابة' : 'Answer'}</Badge>}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!selectedThread.is_locked && (
          <div className="flex gap-2">
            <Textarea
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              placeholder={isAr ? 'اكتب ردك...' : 'Write a reply...'}
              rows={2}
              className="flex-1"
            />
            <Button onClick={() => replyMutation.mutate()} disabled={!replyContent.trim() || replyMutation.isPending} className="self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
        {selectedThread.is_locked && (
          <p className="text-sm text-muted-foreground text-center py-4">
            <Lock className="w-4 h-4 inline me-1" />
            {isAr ? 'هذا الموضوع مغلق' : 'This discussion is locked'}
          </p>
        )}
      </div>
    );
  }

  // Discussion list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {isAr ? 'منتدى الكورس' : 'Course Forum'}
        </h3>
        <Button size="sm" onClick={() => setNewPostDialog(true)}>
          <Plus className="w-4 h-4 me-2" />
          {isAr ? 'موضوع جديد' : 'New Topic'}
        </Button>
      </div>

      {!discussions?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mb-3 opacity-50" />
            <p>{isAr ? 'لا توجد مواضيع بعد' : 'No discussions yet'}</p>
          </CardContent>
        </Card>
      ) : (
        discussions.map((d: any) => (
          <Card key={d.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedThread(d)}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 mt-0.5">
                    <AvatarFallback>{((d.profiles as any)?.full_name || '?')[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      {d.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                      {d.is_locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                      <p className="font-medium">{d.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isAr ? (d.profiles as any)?.full_name_ar : (d.profiles as any)?.full_name}
                      {' • '}
                      {format(new Date(d.updated_at), 'PP', { locale: isAr ? ar : undefined })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{d.reply_count} {isAr ? 'رد' : 'replies'}</Badge>
                  {isInstructor && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin.mutate(d)}>
                        <Pin className={`w-3.5 h-3.5 ${d.is_pinned ? 'text-primary' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleLock.mutate(d)}>
                        <Lock className={`w-3.5 h-3.5 ${d.is_locked ? 'text-destructive' : ''}`} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* New Post Dialog */}
      <Dialog open={newPostDialog} onOpenChange={setNewPostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? 'موضوع جديد' : 'New Discussion'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder={isAr ? 'عنوان الموضوع' : 'Topic title'} value={title} onChange={e => setTitle(e.target.value)} />
            <Textarea placeholder={isAr ? 'اكتب محتوى الموضوع...' : 'Write your post...'} value={content} onChange={e => setContent(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPostDialog(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || !content.trim() || createMutation.isPending}>
              {isAr ? 'نشر' : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
