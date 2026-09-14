import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  Percent,
  Banknote,
  Coins,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getTeacherPayoutSettings,
  getPayoutNegotiations,
  sendTeacherCounterOffer,
  finalizeAgreedPayout,
  TeacherPayoutSettings,
  PayoutNegotiationMessage,
} from "@/lib/teacherLifecycleService";

export const TeacherNegotiationPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { dir } = useLanguage();
  const navigate = useNavigate();

  const [payoutSettings, setPayoutSettings] = useState<TeacherPayoutSettings | null>(null);
  const [messages, setMessages] = useState<PayoutNegotiationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [counterFixed, setCounterFixed] = useState("");
  const [counterPercentage, setCounterPercentage] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [acceptingOffer, setAcceptingOffer] = useState(false);

  const loadNegotiationData = async (isManualRefresh = false) => {
    if (!user) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [settings, msgs] = await Promise.allSettled([
        getTeacherPayoutSettings(user.id),
        getPayoutNegotiations(user.id),
      ]);

      if (settings.status === "fulfilled" && settings.value) {
        setPayoutSettings(settings.value);
      }
      if (msgs.status === "fulfilled") {
        setMessages(msgs.value || []);
      }
    } catch (err) {
      console.error("Error loading negotiation room:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNegotiationData();
  }, [user]);

  const handleAcceptOffer = async () => {
    if (!user || !payoutSettings) return;

    setAcceptingOffer(true);
    try {
      await finalizeAgreedPayout({
        teacherId: user.id,
        agreedType: payoutSettings.agreed_type || payoutSettings.requested_type,
        fixedAmount: payoutSettings.fixed_amount,
        percentageRate: payoutSettings.percentage_rate,
        notes: "تمت موافقة المعلم على العرض رسمياً عبر غرفة المفاوضة المخصصة",
        teacherEmail: profile?.email || user.email,
        teacherName: profile?.full_name || "معلم معتمد",
      });

      toast.success("تهانينا! تم اعتماد وتفعيل الاتفاق المالي لحسابك بنجاح.");
      await loadNegotiationData(true);
    } catch {
      toast.error("حدث خطأ أثناء اعتماد العرض، يرجى المحاولة ثانية");
    } finally {
      setAcceptingOffer(false);
    }
  };

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!counterFixed && !counterPercentage) {
      toast.error("يرجى تحديد النسبة المئوية أو المبلغ المقطوع المطلوب");
      return;
    }
    if (!counterMessage.trim()) {
      toast.error("يرجى كتابة رسالة توضيحية ومبررات العرض للإدارة المالية");
      return;
    }

    setSubmittingCounter(true);
    try {
      await sendTeacherCounterOffer({
        teacherId: user.id,
        message: counterMessage.trim(),
        proposedFixed: counterFixed ? Number(counterFixed) : null,
        proposedPercentage: counterPercentage ? Number(counterPercentage) : null,
      });

      toast.success("تم إرسال ردك وعرضك المقابل إلى الإدارة المالية بنجاح!");
      setCounterMessage("");
      setCounterFixed("");
      setCounterPercentage("");
      await loadNegotiationData(true);
    } catch {
      toast.error("حدث خطأ أثناء إرسال العرض المقابل");
    } finally {
      setSubmittingCounter(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "agreed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold px-3 py-1 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 ml-1 inline text-emerald-700" />
            معتمد ونافذ رسمياً
          </Badge>
        );
      case "offer_sent":
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold px-3 py-1 text-xs animate-pulse">
            <Sparkles className="w-3.5 h-3.5 ml-1 inline text-amber-700" />
            وصلك عرض مالي من الإدارة
          </Badge>
        );
      case "in_negotiation":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold px-3 py-1 text-xs">
            <Clock className="w-3.5 h-3.5 ml-1 inline text-blue-700" />
            قيد التفاوض والمراجعة
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 px-3 py-1 text-xs">
            <Clock className="w-3.5 h-3.5 ml-1 inline text-slate-500" />
            بانتظار مراجعة الإدارة
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800" dir={dir}>
        <Loader2 className="h-10 w-10 animate-spin text-amber-600 mb-4" />
        <p className="font-semibold text-slate-600">جاري فتح غرفة المفاوضة والتوافق المالي...</p>
      </div>
    );
  }

  const isAgreed = payoutSettings?.status === "agreed";

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 selection:bg-amber-100" dir={dir}>
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-white font-black text-xl">
              ج
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900">غرفة المفاوضة والتوافق المالي</h1>
                {getStatusBadge(payoutSettings?.status)}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                بوابة التوافق المالي واعتماد عوائد المقررات - منصة جسوركم الأكاديمية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadNegotiationData(true)}
              disabled={refreshing}
              className="border-slate-200 text-slate-700 hover:bg-slate-100 h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${refreshing ? "animate-spin" : ""}`} />
              تحديث المحادثة
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/instructor")}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-9"
            >
              <ArrowRight className="w-4 h-4 ml-1.5" />
              العودة للوحة التحكم
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column: Active Offer & Current Terms (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden text-start">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">العرض المالي المعتمد</span>
                  <Coins className="w-5 h-5 text-amber-600" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900 pt-1">
                  حالة الاتفاق المالي لمقرراتك
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  نموذج الحساب المعتمد عند بيع وتوزيع الدورات للطلاب
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <span className="text-xs font-bold text-amber-800 block">تفاصيل العرض المتاح حالياً:</span>
                  <div className="space-y-2">
                    {payoutSettings?.percentage_rate !== undefined && payoutSettings?.percentage_rate !== null && (
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-200/80">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Percent className="w-4 h-4 text-amber-600" />
                          نسبة عمولة المعلم:
                        </span>
                        <span className="font-mono font-black text-base text-amber-700">
                          {payoutSettings.percentage_rate}%
                        </span>
                      </div>
                    )}

                    {payoutSettings?.fixed_amount !== undefined && payoutSettings?.fixed_amount !== null && (
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                          المبلغ المقطوع:
                        </span>
                        <span className="font-mono font-black text-base text-slate-900">
                          {Number(payoutSettings.fixed_amount || 0).toLocaleString()} ر.س
                        </span>
                      </div>
                    )}
                  </div>

                  {payoutSettings?.notes && (
                    <div className="pt-2 border-t border-amber-200/60 text-xs">
                      <span className="font-bold text-slate-700 block mb-1">آخر رسالة وملاحظة من الإدارة:</span>
                      <p className="text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed font-sans">
                        "{payoutSettings.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {!isAgreed && (
                  <div className="pt-2">
                    <Button
                      onClick={handleAcceptOffer}
                      disabled={acceptingOffer}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-sm shadow-sm"
                    >
                      {acceptingOffer ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 ml-2" />
                      )}
                      الموافقة على هذا العرض وتفعيل الحساب
                    </Button>
                    <p className="text-[11px] text-slate-400 text-center mt-2 leading-tight">
                      عند النقر على الموافقة، يتم اعتماد الاتفاق فوراً وتفعيل صلاحية رفع المحتوى واستقبال مبيعات الدورات.
                    </p>
                  </div>
                )}

                {isAgreed && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-800 font-bold leading-relaxed">
                      هذا الاتفاق معتمد ونافذ رسمياً. تمت مزامنة دفتر الحسابات المحاسبي لكافة مبيعاتك.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Policy Notice Card */}
            <Card className="bg-slate-50 border-slate-200 p-5 rounded-2xl text-start space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>سياسة الشفافية المالية في جسوركم</span>
              </div>
              <p className="leading-relaxed">
                تلتزم المنصة بدفع مستحقات المعلمين بصورة دورية وموثقة عبر التحويل البنكي المباشر لحسابك المعتمد في بنكك المحلي داخل المملكة.
              </p>
            </Card>
          </div>

          {/* Right Column: Negotiation Dialogue & Counter-Offer Form (8 cols) */}
          <div className="lg:col-span-8 space-y-6 text-start">
            <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col min-h-[580px]">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        سجل المفاوضة والتواصل المباشر
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        سجل التوافق بينك وبين الإدارة المالية لمنصة جسوركم
                      </CardDescription>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                    {messages.length} رسالة
                  </span>
                </div>
              </CardHeader>

              {/* Chat Message List */}
              <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 space-y-3">
                      <MessageSquare className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                      <p className="text-sm font-semibold">لا توجد رسائل سابقة في المفاوضة بعد.</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        يمكنك الاطلاع على العرض المالي المقترح على اليمين والموافقة عليه مباشرة، أو تقديم عرض مقابل أدناه.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isAdmin = msg.sender_type === "admin";
                      return (
                        <div
                          key={msg.id || i}
                          className={`flex gap-3 max-w-[85%] ${isAdmin ? "mr-auto" : "ml-auto flex-row-reverse"}`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isAdmin
                                ? "bg-slate-900 text-white"
                                : "bg-amber-500 text-white"
                            }`}
                          >
                            {isAdmin ? "إ" : "أ"}
                          </div>
                          <div
                            className={`p-4 rounded-2xl text-xs space-y-1.5 shadow-xs border ${
                              isAdmin
                                ? "bg-slate-50 border-slate-200 text-slate-800 rounded-tr-none"
                                : "bg-amber-50/80 border-amber-200 text-amber-950 rounded-tl-none"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 font-bold text-[11px] pb-1 border-b border-black/5">
                              <span className={isAdmin ? "text-slate-600" : "text-amber-800"}>
                                {isAdmin ? "الإدارة المالية (جسوركم)" : "عرضك التوضيحي"}
                              </span>
                              {msg.created_at && (
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {new Date(msg.created_at).toLocaleTimeString("ar-SA", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>

                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>

                            {(msg.proposed_percentage || msg.proposed_fixed) && (
                              <div className="flex items-center gap-2 pt-1 font-mono">
                                {msg.proposed_percentage && (
                                  <span className="bg-white/80 px-2 py-0.5 rounded border text-[11px] font-bold text-amber-800">
                                    النسبة: {msg.proposed_percentage}%
                                  </span>
                                )}
                                {msg.proposed_fixed && (
                                  <span className="bg-white/80 px-2 py-0.5 rounded border text-[11px] font-bold text-slate-800">
                                    المبلغ: {msg.proposed_fixed} ر.س
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Counter-Offer Form at Bottom */}
                <div className="pt-4 border-t border-slate-100">
                  <form onSubmit={handleSendCounter} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>تقديم عرض مقابل أو استفسار توضيحي للإدارة:</span>
                      </Label>
                      <span className="text-[11px] text-slate-400">ستصل رسالتك للإدارة المالية فوراً</span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">
                          النسبة المئوية المقترحة (%):
                        </Label>
                        <Input
                          type="number"
                          placeholder="مثال: 85"
                          min="1"
                          max="95"
                          value={counterPercentage}
                          onChange={(e) => setCounterPercentage(e.target.value)}
                          className="bg-white border-slate-200 text-slate-900 text-xs h-10"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">
                          أو مبلغ مقطوع لكل دورة (ر.س):
                        </Label>
                        <Input
                          type="number"
                          placeholder="مثال: 5000"
                          min="0"
                          value={counterFixed}
                          onChange={(e) => setCounterFixed(e.target.value)}
                          className="bg-white border-slate-200 text-slate-900 text-xs h-10"
                        />
                      </div>
                    </div>

                    <Textarea
                      placeholder="اكتب رسالتك للإدارة ومبررات النسبة المطلوبة وخبراتك الأكاديمية..."
                      value={counterMessage}
                      onChange={(e) => setCounterMessage(e.target.value)}
                      className="bg-white border-slate-200 text-slate-900 text-xs min-h-[85px] leading-relaxed resize-none"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-slate-500">
                        يتم إرسال إشعار فوري للأدمن في لوحة التحكم وتحديث المحادثة لحظياً.
                      </p>
                      <Button
                        type="submit"
                        disabled={submittingCounter}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold h-10 px-5 shadow-xs"
                      >
                        {submittingCounter ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin ml-1.5" />
                        ) : (
                          <Send className="w-3.5 h-3.5 ml-1.5" />
                        )}
                        إرسال العرض المقابل للإدارة
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeacherNegotiationPage;
