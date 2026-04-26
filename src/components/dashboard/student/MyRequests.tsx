import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RequestChat } from './RequestChat';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface RequestFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

interface CourseRequest {
  id: string;
  title: string;
  description: string;
  delivery_method: 'recorded';
  status: 'pending' | 'in_progress' | 'delayed' | 'urgent' | 'completed';
  created_at: string;
  deadline: string | null;
  estimated_price: number | null;
  final_price: number | null;
  notes: string | null;
  files?: RequestFile[];
}

export const MyRequests = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  
  const [requests, setRequests] = useState<CourseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const texts = {
    ar: {
      title: 'طلباتي',
      subtitle: 'تتبع حالة طلبات الكورسات المخصصة',
      noRequests: 'لا توجد طلبات حتى الآن',
      createNew: 'أنشئ طلب جديد',
      status: {
        pending: 'قيد المراجعة',
        in_progress: 'قيد التنفيذ',
        delayed: 'متأخر',
        urgent: 'عاجل',
        completed: 'مكتمل',
      },
      delivery: {
        zoom_live: 'Zoom مباشر',
        meet_live: 'Meet مباشر',
        recorded: 'مسجل',
      },
      deadline: 'الموعد المتوقع',
      price: 'السعر',
      estimatedPrice: 'السعر المتوقع',
      finalPrice: 'السعر النهائي',
      files: 'الملفات المرفقة',
      notes: 'ملاحظات الفريق',
      viewDetails: 'عرض التفاصيل',
      hideDetails: 'إخفاء التفاصيل',
    },
    en: {
      title: 'My Requests',
      subtitle: 'Track your custom course requests status',
      noRequests: 'No requests yet',
      createNew: 'Create new request',
      status: {
        pending: 'Pending Review',
        in_progress: 'In Progress',
        delayed: 'Delayed',
        urgent: 'Urgent',
        completed: 'Completed',
      },
      delivery: {
        zoom_live: 'Live Zoom',
        meet_live: 'Live Meet',
        recorded: 'Recorded',
      },
      deadline: 'Expected Deadline',
      price: 'Price',
      estimatedPrice: 'Estimated Price',
      finalPrice: 'Final Price',
      files: 'Attached Files',
      notes: 'Team Notes',
      viewDetails: 'View Details',
      hideDetails: 'Hide Details',
    },
  };

  const t = texts[language];

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_course_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch files for each request
      const requestsWithFiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: files } = await supabase
            .from('request_files')
            .select('*')
            .eq('request_id', request.id);
          return { ...request, files: files || [] };
        })
      );
      
      setRequests(requestsWithFiles as CourseRequest[]);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: CourseRequest['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'delayed': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: CourseRequest['status']) => {
    switch (status) {
      case 'pending': return Clock;
      case 'in_progress': return Loader2;
      case 'delayed': return AlertCircle;
      case 'urgent': return AlertCircle;
      case 'completed': return CheckCircle;
      default: return Clock;
    }
  };

  const getDeliveryIcon = (method: string) => {
    return FileText;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-64 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t.title}</h2>
        <p className="text-muted-foreground mt-1">{t.subtitle}</p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={language === 'ar' ? 'لا توجد طلبات بعد' : 'No requests yet'}
          description={language === 'ar' 
            ? 'أنشئ طلبك الأول للحصول على كورس مخصص يناسب احتياجاتك الدراسية' 
            : 'Create your first request to get a custom course tailored to your study needs'}
          actionLabel={language === 'ar' ? 'إنشاء طلب جديد' : 'Create New Request'}
          actionLink="/dashboard?tab=request"
          variant="card"
          illustration="requests"
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const StatusIcon = getStatusIcon(request.status);
            const DeliveryIcon = getDeliveryIcon(request.delivery_method);
            const isExpanded = expandedId === request.id;

            return (
              <Card key={request.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{request.title}</h3>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="outline" className={getStatusColor(request.status)}>
                            <StatusIcon className={`w-3 h-3 me-1 ${request.status === 'in_progress' ? 'animate-spin' : ''}`} />
                            {t.status[request.status]}
                          </Badge>
                          <Badge variant="outline" className="bg-muted">
                            <DeliveryIcon className="w-3 h-3 me-1" />
                            {t.delivery[request.delivery_method]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                          {format(new Date(request.created_at), 'PPP', { 
                            locale: language === 'ar' ? ar : enUS 
                          })}
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {request.final_price ? (
                          <div className="text-end">
                            <p className="text-xs text-muted-foreground">{t.finalPrice}</p>
                            <p className="text-lg font-bold text-primary">{request.final_price} ر.س</p>
                          </div>
                        ) : request.estimated_price ? (
                          <div className="text-end">
                            <p className="text-xs text-muted-foreground">{t.estimatedPrice}</p>
                            <p className="text-lg font-semibold text-muted-foreground">{request.estimated_price} ر.س</p>
                          </div>
                        ) : null}
                        
                        {/* Chat Button */}
                        <RequestChat 
                          requestId={request.id} 
                          requestTitle={request.title} 
                        />
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                      className="mt-4 w-full"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4 me-2" />
                          {t.hideDetails}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 me-2" />
                          {t.viewDetails}
                        </>
                      )}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t bg-muted/30"
                      >
                        <div className="p-6 space-y-4">
                          {request.description && (
                            <div>
                              <h4 className="font-medium text-sm text-muted-foreground mb-2">
                                {language === 'ar' ? 'الوصف' : 'Description'}
                              </h4>
                              <p className="text-foreground">{request.description}</p>
                            </div>
                          )}

                          {request.deadline && (
                            <div>
                              <h4 className="font-medium text-sm text-muted-foreground mb-1">{t.deadline}</h4>
                              <p className="text-foreground">
                                {format(new Date(request.deadline), 'PPP', { 
                                  locale: language === 'ar' ? ar : enUS 
                                })}
                              </p>
                            </div>
                          )}

                          {request.notes && (
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                              <h4 className="font-medium text-sm text-primary mb-1">{t.notes}</h4>
                              <p className="text-foreground text-sm">{request.notes}</p>
                            </div>
                          )}

                          {request.files && request.files.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm text-muted-foreground mb-2">{t.files}</h4>
                              <div className="space-y-2">
                                {request.files.map((file) => (
                                  <div
                                    key={file.id}
                                    className="flex items-center gap-3 p-2 rounded-lg bg-background border"
                                  >
                                    <FileText className="w-4 h-4 text-primary" />
                                    <span className="flex-1 text-sm truncate">{file.file_name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {(file.file_size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};