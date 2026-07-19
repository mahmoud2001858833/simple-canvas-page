import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Eye, FileText, Video, Clock, AlertTriangle, CheckCircle, Brain, Sparkles, GraduationCap, Building, Timer, Calendar, Edit, RefreshCw, AlertCircle, MessageCircle, ExternalLink, Download, FolderArchive, User, Mail, Phone, FileIcon, Hash, BookOpen, Image, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { RequestChat } from '@/components/dashboard/student/RequestChat';
import { toast } from 'sonner';
import { format, differenceInDays, differenceInHours, isPast } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface AIClassification {
  university?: string;
  university_en?: string;
  college?: string;
  major?: string;
  subject?: string;
  keywords?: string[];
  content_type?: string;
  confidence?: number;
}

export const RequestsManagement = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isCheckingDeadlines, setIsCheckingDeadlines] = useState(false);
  const [editingAI, setEditingAI] = useState<{ fileId: string; data: AIClassification } | null>(null);
  const [isAnalyzingFiles, setIsAnalyzingFiles] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Function to get signed URL for private bucket files
  const getSignedUrl = async (fileUrl: string): Promise<string> => {
    try {
      // Extract file path from the storage URL
      const storageUrlPattern = /\/storage\/v1\/object\/(?:public|sign)\/request-files\/(.+)/;
      const match = fileUrl.match(storageUrlPattern);
      
      if (match) {
        const filePath = decodeURIComponent(match[1]);
        const { data, error } = await supabase.storage
          .from('request-files')
          .createSignedUrl(filePath, 3600); // 1 hour expiry
        
        if (error) {
          console.error('Error creating signed URL:', error);
          throw error;
        }
        return data.signedUrl;
      }
      
      // If not matching pattern, try to extract path differently
      // Handle URLs like: https://xxx.supabase.co/storage/v1/object/public/request-files/...
      const altPattern = /request-files\/(.+)/;
      const altMatch = fileUrl.match(altPattern);
      
      if (altMatch) {
        const filePath = decodeURIComponent(altMatch[1]);
        const { data, error } = await supabase.storage
          .from('request-files')
          .createSignedUrl(filePath, 3600);
        
        if (error) {
          console.error('Error creating signed URL:', error);
          throw error;
        }
        return data.signedUrl;
      }
      
      // Fallback to original URL if pattern doesn't match
      return fileUrl;
    } catch (err) {
      console.error('Failed to get signed URL:', err);
      throw err;
    }
  };

  // Handle opening file preview
  const handlePreviewFile = async (file: { file_url: string; file_name: string; file_type: string }) => {
    setIsLoadingPreview(true);
    try {
      const signedUrl = await getSignedUrl(file.file_url);
      setPreviewFile({
        url: signedUrl,
        name: file.file_name,
        type: file.file_type
      });
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل في تحميل المعاينة' : 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Handle opening file in new tab
  const handleOpenFile = async (fileUrl: string) => {
    try {
      const signedUrl = await getSignedUrl(fileUrl);
      window.open(signedUrl, '_blank');
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل في فتح الملف' : 'Failed to open file');
    }
  };

  // Handle downloading file
  const handleDownloadFile = async (file: { file_url: string; file_name: string }) => {
    try {
      const signedUrl = await getSignedUrl(file.file_url);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = file.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل في تحميل الملف' : 'Failed to download file');
    }
  };

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin-requests', statusFilter],
    queryFn: async () => {
      // First get all requests
      let query = supabase
        .from('custom_course_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data: requestsData, error } = await query;
      if (error) throw error;
      
      // Fetch user profiles and files separately
      const enrichedRequests = await Promise.all(
        (requestsData || []).map(async (request) => {
          // Get user profile
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', request.user_id)
            .single();
          
          // Get files
          const { data: files } = await supabase
            .from('request_files')
            .select('*')
            .eq('request_id', request.id);
          
          return {
            ...request,
            user: userProfile,
            files: files || []
          };
        })
      );
      
      return enrichedRequests;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase
        .from('custom_course_requests')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      toast.success(language === 'ar' ? 'تم تحديث الحالة' : 'Status updated');
    },
  });

  const updateAIClassificationMutation = useMutation({
    mutationFn: async ({ fileId, classification }: { fileId: string; classification: AIClassification }) => {
      const { error } = await supabase
        .from('request_files')
        .update({ ai_classification: classification as any })
        .eq('id', fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      setEditingAI(null);
      toast.success(language === 'ar' ? 'تم تحديث تصنيف AI' : 'AI classification updated');
    },
  });

  const checkDeadlines = async () => {
    setIsCheckingDeadlines(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-deadlines');
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      toast.success(
        language === 'ar' 
          ? `تم فحص ${data.report?.total_active_requests || 0} طلب` 
          : `Checked ${data.report?.total_active_requests || 0} requests`
      );
    } catch (error: any) {
      console.error('Error checking deadlines:', error);
      toast.error(language === 'ar' ? 'خطأ في فحص المواعيد' : 'Error checking deadlines');
    } finally {
    setIsCheckingDeadlines(false);
    }
  };

  const analyzeFilesWithAI = async (requestId: string) => {
    setIsAnalyzingFiles(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('analyze-request-files', {
        body: { requestId },
      });
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      toast.success(
        language === 'ar' 
          ? `تم تحليل ${data.results?.length || 0} ملف` 
          : `Analyzed ${data.results?.length || 0} files`
      );
    } catch (error: any) {
      console.error('Error analyzing files:', error);
      toast.error(language === 'ar' ? 'خطأ في تحليل الملفات' : 'Error analyzing files');
    } finally {
      setIsAnalyzingFiles(false);
    }
  };

  const downloadAllFilesAsZip = async (requestId: string, requestTitle: string) => {
    setIsDownloadingZip(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-request-files-zip`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download files');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${requestTitle.substring(0, 50)}_files.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(language === 'ar' ? 'تم تحميل الملفات' : 'Files downloaded');
    } catch (error: any) {
      console.error('Error downloading files:', error);
      toast.error(language === 'ar' ? 'خطأ في تحميل الملفات' : 'Error downloading files');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any; label: { ar: string; en: string } }> = {
      pending: { color: 'bg-warning', icon: Clock, label: { ar: 'قيد الانتظار', en: 'Pending' } },
      in_progress: { color: 'bg-info', icon: Loader2, label: { ar: 'قيد التنفيذ', en: 'In Progress' } },
      delayed: { color: 'bg-orange-500', icon: AlertTriangle, label: { ar: 'متأخر', en: 'Delayed' } },
      urgent: { color: 'bg-destructive', icon: AlertTriangle, label: { ar: 'عاجل', en: 'Urgent' } },
      completed: { color: 'bg-success', icon: CheckCircle, label: { ar: 'مكتمل', en: 'Completed' } },
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
      <Badge className={`${cfg.color} text-white flex items-center gap-1 w-fit`}>
        <Icon className="w-3 h-3" />
        {cfg.label[language]}
      </Badge>
    );
  };

  const getDeadlineIndicator = (deadline: string | null, status: string) => {
    if (!deadline || status === 'completed') return null;
    
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysRemaining = differenceInDays(deadlineDate, now);
    const hoursRemaining = differenceInHours(deadlineDate, now);
    const isOverdue = isPast(deadlineDate);

    if (isOverdue) {
      return (
        <div className="flex items-center gap-1.5 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-medium">
            {language === 'ar' ? 'متأخر!' : 'Overdue!'}
          </span>
        </div>
      );
    }

    if (daysRemaining <= 0) {
      return (
        <div className="flex items-center gap-1.5 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
          <Timer className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-medium">
            {hoursRemaining}h
          </span>
        </div>
      );
    }

    if (daysRemaining <= 2) {
      return (
        <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md">
          <Timer className="w-4 h-4" />
          <span className="text-xs font-medium">
            {daysRemaining} {language === 'ar' ? 'يوم' : 'd'}
          </span>
        </div>
      );
    }

    if (daysRemaining <= 7) {
      return (
        <div className="flex items-center gap-1.5 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-md">
          <Calendar className="w-4 h-4" />
          <span className="text-xs font-medium">
            {daysRemaining} {language === 'ar' ? 'يوم' : 'd'}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
        <Calendar className="w-4 h-4" />
        <span className="text-xs font-medium">
          {daysRemaining} {language === 'ar' ? 'يوم' : 'd'}
        </span>
      </div>
    );
  };

  const getDeliveryMethodLabel = (method: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      zoom_live: { ar: 'بث Zoom', en: 'Zoom Live' },
      meet_live: { ar: 'بث Meet', en: 'Meet Live' },
      recorded: { ar: 'مسجل', en: 'Recorded' },
    };
    return labels[method]?.[language] || method;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const renderAIClassification = (classification: AIClassification, fileId: string) => {
    if (!classification) return null;
    return (
      <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-purple-700 dark:text-purple-300">
              {language === 'ar' ? 'تحليل الذكاء الاصطناعي' : 'AI Analysis'}
            </span>
            {classification.confidence && (
              <Badge className={`text-xs ${getConfidenceColor(classification.confidence)}`}>
                {Math.round(classification.confidence * 100)}%
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingAI({ fileId, data: { ...classification } })}
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid gap-2 text-sm">
          {classification.university && (
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === 'ar' ? 'الجهة:' : 'University:'}</span>
              <span className="font-medium">{classification.university}</span>
            </div>
          )}
          {classification.major && (
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === 'ar' ? 'التخصص:' : 'Major:'}</span>
              <span className="font-medium">{classification.major}</span>
            </div>
          )}
          {classification.subject && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{language === 'ar' ? 'المادة:' : 'Subject:'}</span>
              <span className="font-medium">{classification.subject}</span>
            </div>
          )}
          {classification.content_type && (
            <Badge variant="outline" className="w-fit">
              {classification.content_type}
            </Badge>
          )}
          {classification.keywords && classification.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {classification.keywords.slice(0, 5).map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Count requests by urgency
  const overdueCount = requests?.filter((r: any) => r.deadline && isPast(new Date(r.deadline)) && r.status !== 'completed').length || 0;
  const dueSoonCount = requests?.filter((r: any) => {
    if (!r.deadline || r.status === 'completed') return false;
    const days = differenceInDays(new Date(r.deadline), new Date());
    return days >= 0 && days <= 2;
  }).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {language === 'ar' ? 'إدارة الطلبات' : 'Requests Management'}
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              <Sparkles className="w-3 h-3 me-1" />
              AI
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'إدارة طلبات الدورات المخصصة مع تحليل الذكاء الاصطناعي' : 'Manage custom course requests with AI analysis'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={checkDeadlines}
            disabled={isCheckingDeadlines}
          >
            {isCheckingDeadlines ? (
              <Loader2 className="w-4 h-4 me-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 me-2" />
            )}
            {language === 'ar' ? 'فحص المواعيد' : 'Check Deadlines'}
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
              <SelectItem value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</SelectItem>
              <SelectItem value="in_progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
              <SelectItem value="delayed">{language === 'ar' ? 'متأخر' : 'Delayed'}</SelectItem>
              <SelectItem value="urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
              <SelectItem value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deadline Alerts */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800 dark:text-red-300">
                {overdueCount} {language === 'ar' ? 'طلب متأخر' : 'overdue request(s)'}
              </span>
            </div>
          )}
          {dueSoonCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <Timer className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-800 dark:text-orange-300">
                {dueSoonCount} {language === 'ar' ? 'طلب يستحق قريباً' : 'request(s) due soon'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['pending', 'in_progress', 'delayed', 'urgent', 'completed'].map((status) => {
          const count = requests?.filter((r: any) => r.status === status).length || 0;
          return (
            <div
              key={status}
              className={`card-premium p-4 cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            >
              <div className="text-2xl font-bold mb-1">{count}</div>
              {getStatusBadge(status)}
            </div>
          );
        })}
      </div>

      {/* Requests Table */}
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الطالب' : 'Student'}</TableHead>
                <TableHead>{language === 'ar' ? 'العنوان' : 'Title'}</TableHead>
                <TableHead>{language === 'ar' ? 'الموعد النهائي' : 'Deadline'}</TableHead>
                <TableHead>{language === 'ar' ? 'طريقة التقديم' : 'Delivery'}</TableHead>
                <TableHead>{language === 'ar' ? 'الملفات' : 'Files'}</TableHead>
                <TableHead>{language === 'ar' ? 'AI' : 'AI'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((request: any) => {
                const hasAI = request.files?.some((f: any) => f.ai_classification);
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.user?.full_name || '-'}</div>
                        <div className="text-sm text-muted-foreground">{request.user?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>
                      {request.deadline ? (
                        <div className="space-y-1">
                          <div className="text-sm">
                            {format(new Date(request.deadline), 'd MMM', {
                              locale: language === 'ar' ? ar : enUS,
                            })}
                          </div>
                          {getDeadlineIndicator(request.deadline, request.status)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <Video className="w-3 h-3" />
                        {getDeliveryMethodLabel(request.delivery_method)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <FileText className="w-3 h-3" />
                        {request.files?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasAI ? (
                        <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                          <Brain className="w-3 h-3" />
                          ✓
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* Primary Download Course Files Button */}
                        {request.files?.filter((f: any) => f.file_category === 'file').length > 0 && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const courseFiles = request.files.filter((f: any) => f.file_category === 'file');
                              if (courseFiles.length === 1) {
                                await handleDownloadFile(courseFiles[0]);
                              } else {
                                // Download all as ZIP if multiple files
                                await downloadAllFilesAsZip(request.id, request.title);
                              }
                            }}
                          >
                            <Download className="w-4 h-4 me-1" />
                            {language === 'ar' ? 'تحميل الملف' : 'Download File'}
                            {request.files.filter((f: any) => f.file_category === 'file').length > 1 && (
                              <Badge variant="secondary" className="ms-1 bg-white/20 text-white text-xs">
                                {request.files.filter((f: any) => f.file_category === 'file').length}
                              </Badge>
                            )}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(request)}>
                          <Eye className="w-4 h-4 me-1" />
                          {language === 'ar' ? 'عرض' : 'View'}
                        </Button>
                        <RequestChat 
                          requestId={request.id} 
                          requestTitle={request.title} 
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {language === 'ar' ? 'تفاصيل الطلب الكاملة' : 'Full Request Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Header with ID */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{selectedRequest.title}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      <Hash className="w-3 h-3 me-1" />
                      {selectedRequest.id.substring(0, 8)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Student Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground">{language === 'ar' ? 'الطالب' : 'Student'}</div>
                        <div className="font-medium">{selectedRequest.user?.full_name || '-'}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</div>
                        <div className="font-medium text-sm">{selectedRequest.user?.email || '-'}</div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Request Details Grid */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Video className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground">{language === 'ar' ? 'طريقة التقديم' : 'Delivery'}</div>
                        <Badge variant="outline" className="mt-1">
                          {getDeliveryMethodLabel(selectedRequest.delivery_method)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</div>
                        <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm text-muted-foreground">{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</div>
                        <div className="font-medium text-sm">
                          {format(new Date(selectedRequest.created_at), 'PPP', {
                            locale: language === 'ar' ? ar : enUS,
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deadline with indicator */}
                  {selectedRequest.deadline && (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg border-2 border-dashed">
                      <div className="flex items-center gap-3">
                        <Timer className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">{language === 'ar' ? 'الموعد النهائي' : 'Deadline'}</div>
                          <div className="font-semibold">
                            {format(new Date(selectedRequest.deadline), 'PPP p', {
                              locale: language === 'ar' ? ar : enUS,
                            })}
                          </div>
                        </div>
                      </div>
                      {getDeadlineIndicator(selectedRequest.deadline, selectedRequest.status)}
                    </div>
                  )}

                  {/* Prices */}
                  {(selectedRequest.estimated_price || selectedRequest.final_price) && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {selectedRequest.estimated_price && (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground">{language === 'ar' ? 'السعر المتوقع' : 'Estimated Price'}</div>
                          <div className="font-bold text-lg">{selectedRequest.estimated_price} SAR</div>
                        </div>
                      )}
                      {selectedRequest.final_price && (
                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="text-sm text-muted-foreground">{language === 'ar' ? 'السعر النهائي' : 'Final Price'}</div>
                          <div className="font-bold text-lg text-primary">{selectedRequest.final_price} SAR</div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{language === 'ar' ? 'الوصف' : 'Description'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {selectedRequest.description || (language === 'ar' ? 'لا يوجد وصف' : 'No description')}
                  </p>
                </CardContent>
              </Card>

              {/* Notes (if any) */}
              {selectedRequest.notes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{language === 'ar' ? 'ملاحظات' : 'Notes'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{selectedRequest.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Files Section */}
              {selectedRequest.files?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileIcon className="w-4 h-4" />
                        {language === 'ar' ? 'الملفات المرفقة' : 'Attached Files'}
                        <Badge variant="secondary">{selectedRequest.files.length}</Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => analyzeFilesWithAI(selectedRequest.id)}
                          disabled={isAnalyzingFiles}
                        >
                          {isAnalyzingFiles ? (
                            <Loader2 className="w-4 h-4 me-2 animate-spin" />
                          ) : (
                            <Brain className="w-4 h-4 me-2" />
                          )}
                          {language === 'ar' ? 'تحليل AI' : 'AI Analyze'}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => downloadAllFilesAsZip(selectedRequest.id, selectedRequest.title)}
                          disabled={isDownloadingZip}
                        >
                          {isDownloadingZip ? (
                            <Loader2 className="w-4 h-4 me-2 animate-spin" />
                          ) : (
                            <FolderArchive className="w-4 h-4 me-2" />
                          )}
                          {language === 'ar' ? 'تحميل الكل ZIP' : 'Download All ZIP'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedRequest.files.map((file: any) => (
                      <div key={file.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          {file.file_category === 'image' ? (
                            <Image className="w-5 h-5 text-purple-500" />
                          ) : (
                            <FileText className="w-5 h-5 text-blue-500" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium">{file.file_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                              {/* File Category Badge */}
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  file.file_category === 'image' 
                                    ? 'border-purple-300 text-purple-600 bg-purple-50 dark:bg-purple-900/20' 
                                    : 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                }`}
                              >
                                {file.file_category === 'image' 
                                  ? (language === 'ar' ? 'صورة المادة' : 'Course Image')
                                  : (language === 'ar' ? 'ملف المادة' : 'Course File')
                                }
                              </Badge>
                              <span>•</span>
                              <span>{file.file_type}</span>
                              {file.file_size && (
                                <>
                                  <span>•</span>
                                  <span>{(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Inline Preview Button */}
                            {(file.file_type?.startsWith('image/') || file.file_type === 'application/pdf') && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handlePreviewFile(file)}
                                disabled={isLoadingPreview}
                                className="flex items-center gap-1"
                              >
                                {isLoadingPreview ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                                {language === 'ar' ? 'معاينة' : 'Preview'}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenFile(file.file_url)}
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="w-4 h-4" />
                              {language === 'ar' ? 'فتح' : 'Open'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadFile(file)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {file.ai_classification ? (
                          renderAIClassification(file.ai_classification, file.id)
                        ) : (
                          <div className="text-sm text-muted-foreground italic p-3 bg-muted rounded-lg">
                            {language === 'ar' ? 'لم يتم تحليل هذا الملف بعد. اضغط على "تحليل AI" أعلاه.' : 'This file has not been analyzed yet. Click "AI Analyze" above.'}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Status Update */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{language === 'ar' ? 'تحديث الحالة' : 'Update Status'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedRequest.status}
                    onValueChange={(status) => {
                      updateStatusMutation.mutate({ id: selectedRequest.id, status });
                      setSelectedRequest({ ...selectedRequest, status });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</SelectItem>
                      <SelectItem value="in_progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                      <SelectItem value="delayed">{language === 'ar' ? 'متأخر' : 'Delayed'}</SelectItem>
                      <SelectItem value="urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
                      <SelectItem value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit AI Classification Dialog */}
      <Dialog open={!!editingAI} onOpenChange={() => setEditingAI(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل تصنيف AI' : 'Edit AI Classification'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'عدّل نتائج تحليل الذكاء الاصطناعي يدوياً' : 'Manually edit AI analysis results'}
            </DialogDescription>
          </DialogHeader>
          {editingAI && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الجهة' : 'University'}</Label>
                <Input
                  value={editingAI.data.university || ''}
                  onChange={(e) => setEditingAI({
                    ...editingAI,
                    data: { ...editingAI.data, university: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'التخصص' : 'Major'}</Label>
                <Input
                  value={editingAI.data.major || ''}
                  onChange={(e) => setEditingAI({
                    ...editingAI,
                    data: { ...editingAI.data, major: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'المادة' : 'Subject'}</Label>
                <Input
                  value={editingAI.data.subject || ''}
                  onChange={(e) => setEditingAI({
                    ...editingAI,
                    data: { ...editingAI.data, subject: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'نوع المحتوى' : 'Content Type'}</Label>
                <Select
                  value={editingAI.data.content_type || ''}
                  onValueChange={(value) => setEditingAI({
                    ...editingAI,
                    data: { ...editingAI.data, content_type: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">{language === 'ar' ? 'اختبار' : 'Exam'}</SelectItem>
                    <SelectItem value="slides">{language === 'ar' ? 'شرائح' : 'Slides'}</SelectItem>
                    <SelectItem value="notes">{language === 'ar' ? 'ملاحظات' : 'Notes'}</SelectItem>
                    <SelectItem value="summary">{language === 'ar' ? 'ملخص' : 'Summary'}</SelectItem>
                    <SelectItem value="assignment">{language === 'ar' ? 'واجب' : 'Assignment'}</SelectItem>
                    <SelectItem value="other">{language === 'ar' ? 'آخر' : 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الكلمات المفتاحية (مفصولة بفواصل)' : 'Keywords (comma-separated)'}</Label>
                <Textarea
                  value={editingAI.data.keywords?.join(', ') || ''}
                  onChange={(e) => setEditingAI({
                    ...editingAI,
                    data: { ...editingAI.data, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) }
                  })}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAI(null)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => {
                if (editingAI) {
                  updateAIClassificationMutation.mutate({
                    fileId: editingAI.fileId,
                    classification: editingAI.data,
                  });
                }
              }}
              disabled={updateAIClassificationMutation.isPending}
            >
              {updateAIClassificationMutation.isPending && (
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
              )}
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {previewFile?.type?.startsWith('image/') ? (
                  <Image className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                {previewFile?.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewFile?.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 me-1" />
                  {language === 'ar' ? 'فتح في نافذة جديدة' : 'Open in new tab'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="relative overflow-auto" style={{ height: 'calc(95vh - 100px)' }}>
            {previewFile?.type?.startsWith('image/') ? (
              <div className="flex items-center justify-center p-4 bg-muted/30 min-h-full">
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  style={{ maxHeight: 'calc(95vh - 150px)' }}
                />
              </div>
            ) : previewFile?.type === 'application/pdf' ? (
              <iframe
                src={`${previewFile.url}#toolbar=1&navpanes=0`}
                className="w-full h-full border-0"
                title={previewFile.name}
                style={{ minHeight: 'calc(95vh - 100px)' }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {language === 'ar' 
                    ? 'لا يمكن معاينة هذا الملف. استخدم زر التحميل لرؤية المحتوى.' 
                    : 'Cannot preview this file. Use the download button to view content.'}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.open(previewFile?.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'فتح الملف' : 'Open File'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
