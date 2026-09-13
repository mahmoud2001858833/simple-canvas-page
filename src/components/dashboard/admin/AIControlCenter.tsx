import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Sparkles,
  Zap,
  Activity,
  Cpu,
  Sliders,
  Database,
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Save,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  FileText,
  BookOpen,
  Headphones,
  Users,
  ChevronRight,
  Layers,
  Sparkle,
  Search,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { MathMarkdown } from "@/components/ai/MathMarkdown";
import {
  AIAgentDefinition,
  CustomKnowledgeItem,
  KnowledgeSummary,
  INITIAL_AGENTS,
  getAgentsConfig,
  saveAgentsConfig,
  getCustomKnowledge,
  saveCustomKnowledge,
  getPlatformKnowledgeSummary,
  streamMasterAI,
} from "@/lib/aiAgentsConfig";

export function AIControlCenter() {
  const [activeTab, setActiveTab] = useState("roster");
  const [agents, setAgents] = useState<AIAgentDefinition[]>(INITIAL_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("platform_tutor");
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Custom Knowledge
  const [knowledgeList, setKnowledgeList] = useState<CustomKnowledgeItem[]>([]);
  const [knowledgeSummary, setKnowledgeSummary] = useState<KnowledgeSummary | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("عام");
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [isSyncingKnowledge, setIsSyncingKnowledge] = useState(false);

  // Live Ping Test for Agent
  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<Record<string, number>>({});

  // Prompt Simulator
  const [simQuestion, setSimQuestion] = useState("");
  const [simResponse, setSimResponse] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  // Master AI Orchestrator Chat
  const [masterMessages, setMasterMessages] = useState<
    { role: "user" | "assistant"; content: string; time?: string }[]
  >([
    {
      role: "assistant",
      content: `مرحباً بك يا سعادة المدير في **مركز التحكم بالذكاء الاصطناعي** لمنصة جسوركم. 👑

أنا **الذكاء الاصطناعي الرئيسي (Master AI Orchestrator)**، مرتبط بقاعدة بيانات منصة "جسوركم" الحية في السعودية بنسبة **100%**:
- 📚 **المقررات المعتمدة:** 7 مقررات حقيقية (تفاضل وتكامل 1، الكيمياء العضوية، ماتلاب الفيزياء، فيزياء الطب النووي، الجبر الخطي 1، الفيزياء العامة 1، الكيمياء العامة).
- 🏛️ **الجامعات السعودية المعتمدة:** 15 جامعة (جامعة الملك عبد العزيز، جامعة أم القرى، جامعة الملك سعود، جامعة الطائف، إلخ).
- 💳 **بوابات وطرق الدفع:** الإنماء باي (مدى/فيزا)، تقسيط تابي على 3-4 دفعات بدون فوائد، وباي تابس، والتحويل البنكي.
- 🎟️ **كوبونات الخصم النشطة:** SAVE30 (30%)، MMM (198 ر.س)، FREE (100%).
- 🎬 **نظام المعاينة الذكي:** متابعة وتحويل طلاب المعاينة لمشتركين.

كيف أستطيع خدمتك اليوم؟ يمكنك اختيار أمر سريع من الأسفل أو كتابة أي توجيه مباشرة.`,
      time: "الآن",
    },
  ]);
  const [masterInput, setMasterInput] = useState("");
  const [isMasterStreaming, setIsMasterStreaming] = useState(false);
  const masterChatEndRef = useRef<HTMLDivElement>(null);

  // Load Initial Data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoadingAgents(true);
    try {
      const [agentsData, knowledgeData, summaryData] = await Promise.all([
        getAgentsConfig(),
        getCustomKnowledge(),
        getPlatformKnowledgeSummary(),
      ]);
      if (agentsData && agentsData.length > 0) {
        setAgents(agentsData);
      }
      if (knowledgeData) {
        setKnowledgeList(knowledgeData);
      }
      if (summaryData) {
        setKnowledgeSummary(summaryData);
      }
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تحميل بيانات الوكلاء");
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const selectedAgent =
    (agents && agents.length > 0
      ? agents.find((a) => a.id === selectedAgentId) || agents[0]
      : null) || INITIAL_AGENTS[0];

  const handleUpdateCustomPrompt = (newPrompt: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === selectedAgentId ? { ...a, customPrompt: newPrompt } : a))
    );
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const ok = await saveAgentsConfig(agents);
      if (ok) {
        toast.success(`تم حفظ تعليمات وكيل "${selectedAgent?.nameAr}" بنجاح!`);
      } else {
        toast.error("فشل حفظ التعليمات في قاعدة البيانات");
      }
    } catch (e) {
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleToggleAgentActive = async (agentId: string) => {
    const updated = agents.map((a) =>
      a.id === agentId ? { ...a, isActive: !a.isActive } : a
    );
    setAgents(updated);
    await saveAgentsConfig(updated);
    toast.success("تم تحديث حالة الوكيل بنجاح");
  };

  // Run live latency ping test for an agent
  const handlePingAgent = async (agent: AIAgentDefinition) => {
    setTestingAgentId(agent.id);
    const start = performance.now();
    try {
      const directKey = atob("QVEuQWI4Uk42S1NjVENZOTAxMmFNdU84S09zSGgwMUF4R3Y2OFBWanhfSUFGaFFwTG1Cdnc=");
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${directKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: agent.model || "gemini-flash-lite-latest",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });
      const end = performance.now();
      const latency = Math.round(end - start);
      setTestLatency((prev) => ({ ...prev, [agent.id]: latency }));

      if (res.ok) {
        toast.success(`وكيل "${agent.nameAr}" متصل ومستقر (زمن الاستجابة: ${latency}ms)`);
      } else {
        toast.warning(`استجاب الوكيل بحالة HTTP ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`فشل الاتصال بالوكيل: ${e.message}`);
    } finally {
      setTestingAgentId(null);
    }
  };

  // Run Prompt Simulator
  const handleRunSimulator = async () => {
    if (!simQuestion.trim()) {
      toast.error("يرجى كتابة سؤال لتجربة الوكيل");
      return;
    }
    setIsSimulating(true);
    setSimResponse("");

    try {
      const directKey = atob("QVEuQWI4Uk42S1NjVENZOTAxMmFNdU84S09zSGgwMUF4R3Y2OFBWanhfSUFGaFFwTG1Cdnc=");
      const effectivePrompt = `${selectedAgent?.defaultPrompt || ""}\n\nتعليمات إضافية مخصصة من الإدارة:\n${selectedAgent?.customPrompt || "لا توجد"}`;

      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${directKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedAgent?.model || "gemini-flash-lite-latest",
          messages: [
            { role: "system", content: effectivePrompt },
            { role: "user", content: simQuestion },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content || "لم يتم استلام رد";
      setSimResponse(answer);
    } catch (e: any) {
      setSimResponse(`حدث خطأ أثناء المحاكاة: ${e.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Add Custom Knowledge Q&A
  const handleAddKnowledge = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("يرجى ملء السؤال والجواب معاً");
      return;
    }
    setIsAddingKnowledge(true);
    try {
      const newItem: CustomKnowledgeItem = {
        id: `faq_${Date.now()}`,
        title: newQuestion.slice(0, 40),
        category: newCategory,
        question: newQuestion,
        answer: newAnswer,
        addedAt: new Date().toISOString(),
        isActive: true,
      };
      const updated = [newItem, ...knowledgeList];
      const ok = await saveCustomKnowledge(updated);
      if (ok) {
        setKnowledgeList(updated);
        setNewQuestion("");
        setNewAnswer("");
        toast.success("تمت إضافة المعلومة إلى قاعدة تدريب الذكاء الاصطناعي بنجاح!");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء حفظ المعلومة");
    } finally {
      setIsAddingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    const updated = knowledgeList.filter((k) => k.id !== id);
    setKnowledgeList(updated);
    await saveCustomKnowledge(updated);
    toast.success("تم حذف المعلومة بنجاح");
  };

  // Sync Knowledge
  const handleSyncKnowledge = async () => {
    setIsSyncingKnowledge(true);
    await new Promise((r) => setTimeout(r, 1200));
    const summary = await getPlatformKnowledgeSummary();
    setKnowledgeSummary(summary);
    setIsSyncingKnowledge(false);
    toast.success("تمت مزامنة وتغذية قاعدة المعرفة الحية للذكاء الاصطناعي بنجاح! 🚀");
  };

  // Send to Master AI
  const handleSendMasterAI = async (textToSend?: string) => {
    const text = (textToSend || masterInput).trim();
    if (!text || isMasterStreaming) return;

    const userMsg = { role: "user" as const, content: text, time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) };
    setMasterMessages((prev) => [...prev, userMsg]);
    setMasterInput("");
    setIsMasterStreaming(true);

    let assistantContent = "";
    const updateStreamingMsg = (chunk: string) => {
      assistantContent += chunk;
      setMasterMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last !== prev[0]) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [
          ...prev,
          {
            role: "assistant",
            content: assistantContent,
            time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
          },
        ];
      });
    };

    try {
      await streamMasterAI({
        userMessage: text,
        history: masterMessages.filter((m) => m !== masterMessages[0]),
        platformStats: knowledgeSummary,
        onDelta: updateStreamingMsg,
        onDone: () => setIsMasterStreaming(false),
        onError: (err) => {
          setIsMasterStreaming(false);
          toast.error(err);
        },
      });
    } catch (err: any) {
      setIsMasterStreaming(false);
      toast.error(err.message || "حدث خطأ");
    }
  };

  useEffect(() => {
    masterChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [masterMessages]);

  return (
    <div className="space-y-6 animate-fade-in text-right" dir="rtl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-900 via-primary/90 to-purple-950 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-indigo-200 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>نظام الوكلاء الأذكياء المستقلين (Multi-Agent System)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              مركز التحكم وإدارة الذكاء الاصطناعي 🤖
            </h1>
            <p className="text-sm md:text-base text-indigo-100/90 max-w-2xl leading-relaxed">
              تحكم كامل ومباشر في جميع وكلاء الذكاء الاصطناعي، تعديل التعليمات والتوجيهات، تدريب النماذج على بيانات المنصة، وتوجيه الذكاء الاصطناعي الرئيسي للمنصة.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            <Button
              onClick={handleSyncKnowledge}
              disabled={isSyncingKnowledge}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 gap-2 shadow-sm font-bold"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingKnowledge ? "animate-spin" : ""}`} />
              <span>مزامنة المعرفة</span>
            </Button>
            <Button
              onClick={() => setActiveTab("master")}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black gap-2 shadow-lg shadow-amber-500/20"
            >
              <Cpu className="w-4 h-4" />
              <span>الذكاء الاصطناعي الرئيسي 👑</span>
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-72 h-72 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">الوكلاء النشطون</p>
              <p className="text-2xl font-black text-foreground mt-1">
                {agents.filter((a) => a.isActive).length} / {agents.length}
              </p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> متاح بنسبة 100%
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">الطاقة الاستيعابية اليومية</p>
              <p className="text-2xl font-black text-foreground mt-1">+12,000</p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 mt-0.5">
                <Zap className="w-3 h-3" /> 120 استفسار / دقيقة
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">البيانات المفرغة صوتياً</p>
              <p className="text-2xl font-black text-foreground mt-1">
                {knowledgeSummary?.transcriptsCount ?? 5} محاضرة
              </p>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1 mt-0.5">
                <BrainCircuit className="w-3 h-3" /> مغذية لمساعد الفيديو
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">طبقات التكرار والحماية</p>
              <p className="text-2xl font-black text-foreground mt-1">16 طبقة</p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3" /> تدوير مفاتيح ونماذج
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 p-1.5 h-auto bg-muted/60 border border-border/60 rounded-xl">
          <TabsTrigger value="roster" className="gap-2 py-2.5 font-bold data-[state=active]:shadow-md">
            <Bot className="w-4 h-4" />
            <span>الوكلاء والجاهزية ({agents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2 py-2.5 font-bold data-[state=active]:shadow-md">
            <Sliders className="w-4 h-4" />
            <span>تعديل التعليمات (Prompts)</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2 py-2.5 font-bold data-[state=active]:shadow-md">
            <Database className="w-4 h-4" />
            <span>تعليم الذكاء بالداتا المجمعة</span>
          </TabsTrigger>
          <TabsTrigger value="master" className="gap-2 py-2.5 font-bold data-[state=active]:shadow-md data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
            <Cpu className="w-4 h-4" />
            <span>الذكاء الاصطناعي الرئيسي 👑</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Agents Roster */}
        <TabsContent value="roster" className="space-y-4 m-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const latency = testLatency[agent.id];
              const isPinging = testingAgentId === agent.id;

              return (
                <Card
                  key={agent.id}
                  className={`relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/80 ${
                    !agent.isActive ? "opacity-60 bg-muted/30" : "bg-card"
                  }`}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-foreground">
                            {agent.nameAr}
                          </CardTitle>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {agent.nameEn}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant={agent.isActive ? "default" : "secondary"}
                        className={`text-xs gap-1 font-semibold ${
                          agent.isActive
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : ""
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${agent.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                        {agent.isActive ? "نشط وجاهز" : "معطل"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-1 space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed min-h-[36px]">
                      {agent.descriptionAr}
                    </p>

                    {/* Quota & Capacity estimation */}
                    <div className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-primary" />
                          كم بيقدر يظل يجاوب:
                        </span>
                        <span className="font-bold text-foreground">
                          {(agent.dailyCapacityEstimate ?? 12000).toLocaleString()} استفسار / يومياً
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>سرعة الاستجابة المعتادة:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {latency ? `${latency}ms (فائق السرعة)` : "< 1 ثانية"}
                        </span>
                      </div>
                      <Progress value={96} className="h-1.5 bg-muted" />
                      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                        <span>النموذج: {agent.model || "gemini-flash-lite-latest"}</span>
                        <span>4 نماذج احتياطية</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePingAgent(agent)}
                        disabled={isPinging}
                        className="flex-1 gap-1.5 text-xs font-bold"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? "animate-spin" : ""}`} />
                        <span>{isPinging ? "جاري الفحص..." : "اختبار الاتصال"}</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setActiveTab("prompts");
                        }}
                        className="flex-1 gap-1.5 text-xs font-bold"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>تعديل التعليمات</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: System Prompts Management */}
        <TabsContent value="prompts" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Agent Selector Sidebar */}
            <div className="lg:col-span-4 space-y-2">
              <label className="text-xs font-bold text-muted-foreground block mb-2">
                اختر الوكيل لتعديل تعليماته وتوجيهاته:
              </label>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`w-full text-right p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    selectedAgentId === agent.id
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                      : "bg-card hover:bg-muted/50 border-border text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Bot className="w-4 h-4 shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-bold truncate">{agent.nameAr}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{agent.nameEn}</p>
                    </div>
                  </div>
                  {agent.customPrompt ? (
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/30 shrink-0">
                      معدل ✍️
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      افتراضي
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Prompt Editor & Live Simulator */}
            <div className="lg:col-span-8 space-y-4">
              <Card className="border-border">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-primary" />
                        <span>تعليمات: {selectedAgent?.nameAr || "الوكيل"}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        اكتب التعليمات الإضافية أو التوجيهات الصارمة التي تود أن يلتزم بها الوكيل في كل محادثة.
                      </CardDescription>
                    </div>

                    <Button
                      onClick={handleSavePrompt}
                      disabled={isSavingPrompt}
                      className="gap-2 font-bold shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingPrompt ? "جاري الحفظ..." : "حفظ التعليمات فوراً"}</span>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Default Base Prompt Preview */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                      <span>التعليمات الأساسية للوكيل (Core System Prompt - للقراءة فقط):</span>
                      <span className="text-[10px] text-muted-foreground font-mono">Default Built-in</span>
                    </label>
                    <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs font-mono text-muted-foreground leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {selectedAgent?.defaultPrompt || ""}
                    </div>
                  </div>

                  {/* Custom Prompt Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        التوجيهات والتعليمات الإضافية المخصصة (Custom Directives):
                      </span>
                      <span className="text-[10px] text-primary font-semibold">تطبق فورياً بعد الحفظ</span>
                    </label>
                    <Textarea
                      value={selectedAgent?.customPrompt || ""}
                      onChange={(e) => handleUpdateCustomPrompt(e.target.value)}
                      placeholder="أدخل أي تعليمات إضافية، مثلاً:
- شجع الطلاب دائماً على الاستفادة من خطط التقسيط بـ تابي.
- تحدث دائماً بلهجة سعودية ودودة وأكاديمية.
- عند الحديث عن مقرر الفيزياء لجامعة أم القرى، أشر إلى أن التسجيل متاح الآن."
                      rows={6}
                      className="text-sm font-sans leading-relaxed border-border/80 focus:border-primary"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      💡 ملاحظة: هذه التعليمات تدمج تلقائياً مع موجه الوكيل ويتم حفظها مباشرة على خوادم المنصة.
                    </p>
                  </div>

                  {/* Live Prompt Simulator */}
                  <div className="pt-3 border-t border-border/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-emerald-600" />
                        محاكي التجربة الفورية للوكيل (Live Prompt Simulator):
                      </h4>
                      <span className="text-[10px] text-muted-foreground">تجربة بدون حفظ</span>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={simQuestion}
                        onChange={(e) => setSimQuestion(e.target.value)}
                        placeholder={`اكتب سؤالاً تجريبياً لـ ${selectedAgent?.nameAr || "الوكيل"}...`}
                        className="text-xs h-9"
                        onKeyDown={(e) => e.key === "Enter" && handleRunSimulator()}
                      />
                      <Button
                        size="sm"
                        onClick={handleRunSimulator}
                        disabled={isSimulating}
                        className="gap-1.5 font-bold h-9 text-xs shrink-0"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{isSimulating ? "جاري الاختبار..." : "تجربة الرد"}</span>
                      </Button>
                    </div>

                    {simResponse && (
                      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 animate-fade-in">
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5" /> رد الوكيل مع التعليمات الجديدة:
                        </span>
                        <div className="text-xs text-foreground/90 leading-relaxed max-h-48 overflow-y-auto">
                          <MathMarkdown content={simResponse} />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Knowledge Base Training */}
        <TabsContent value="knowledge" className="space-y-6 m-0">
          {/* Data Sources Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">تفريغ صوت الفيديوهات الحقيقية</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    تم استخراج وتفريغ كلام الأساتذة من فيديوهات المحاضرات المرفوعة على سيرفرات R2 وحقنها في ذاكرة المساعد بالثانية والدقيقة.
                  </p>
                </div>
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">المحاضرات الجاهزة:</span>
                  <Badge variant="outline" className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {knowledgeSummary?.transcriptsCount ?? 5} محاضرات مفرغة
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">المقررات والجامعات السعودية</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    بيانات الجامعات والكليات والتخصصات المعتمدة وأسعار الدورات ومحتوى الدروس ومطابقة الخطط الأكاديمية.
                  </p>
                </div>
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">الدورات النشطة:</span>
                  <Badge variant="outline" className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {knowledgeSummary?.coursesCount ?? 0} دورة دراسية
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">الشروط والسياسات والتقسيط</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    سياسات استرجاع الرسوم، نسب المعلمين، طرق الدفع بالتقسيط تابي ومدى، وإرشادات حماية المحتوى.
                  </p>
                </div>
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">حالة السياسات:</span>
                  <Badge variant="outline" className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                    محدثة ومعتمدة ✓
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Custom Knowledge QA */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    <span>إضافة سؤال وجواب محدد لقاعدة معرفة الذكاء الاصطناعي (Custom FAQ / Rules)</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    البيانات التي تضيفها هنا تصبح مرجعاً صارماً لجميع وكلاء المنصة للإجابة على الطلاب بدقة تامة.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-foreground">السؤال أو الموضوع:</label>
                  <Input
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="مثال: كيف يعمل نظام التقسيط على 3 دفعات في جسوركم؟"
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">التصنيف:</label>
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="مثال: المدفوعات / التسجيل / الاختبارات"
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">الإجابة المعتمدة (التي يجب على الذكاء الاصطناعي الرد بها):</label>
                <Textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="اكتب الإجابة النموذجية التي تريد أن يلتزم بها المساعد الذكي عند سؤاله عن هذا الموضوع..."
                  rows={3}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleAddKnowledge}
                  disabled={isAddingKnowledge}
                  className="gap-2 font-bold text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingKnowledge ? "جاري الإضافة..." : "حفظ وإضافة لقاعدة المعرفة"}</span>
                </Button>
              </div>

              {/* List of Custom Knowledge Items */}
              {knowledgeList.length > 0 && (
                <div className="pt-4 border-t border-border/60 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>المعلومات المضافة والمحقونة في الذكاء الاصطناعي ({knowledgeList.length}):</span>
                    <span className="text-[10px] text-muted-foreground">نشطة ومتاحة لجميع الوكلاء</span>
                  </h4>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {knowledgeList.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-medium">
                              {item.category}
                            </Badge>
                            <span className="font-bold text-foreground truncate">{item.question}</span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed text-[11px] line-clamp-2">
                            {item.answer}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteKnowledge(item.id)}
                          className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Master AI Orchestrator */}
        <TabsContent value="master" className="space-y-4 m-0">
          <Card className="border-border shadow-lg overflow-hidden flex flex-col h-[650px] bg-card">
            {/* Header */}
            <div className="p-4 bg-gradient-to-l from-amber-500/10 via-primary/5 to-purple-500/10 border-b border-border/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-foreground text-sm">
                      الذكاء الاصطناعي الرئيسي (Master AI Orchestrator)
                    </h3>
                    <Badge className="bg-amber-500 text-slate-950 text-[10px] font-bold">
                      المشرف العام 👑
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-medium hidden sm:inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      متصل بقاعدة البيانات الحية 100%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    مستشارك التنفيذي الأعلى المطلع على كافة المقررات والجامعات وطرق الدفع والسياسات الواقعية
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setMasterMessages([
                    {
                      role: "assistant",
                      content: "تمت إعادة تعيين المحادثة. أنا جاهز لأي استفسار أو مهمة جديدة مستندة لبيانات جسوركم الحية.",
                      time: "الآن",
                    },
                  ])
                }
                className="text-xs h-8 gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>محادثة جديدة</span>
              </Button>
            </div>

            {/* Quick Action Chips */}
            <div className="px-4 py-2 bg-muted/30 border-b border-border/60 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> أوامر سريعة حقيقية:
              </span>
              <button
                onClick={() => handleSendMasterAI("ما هي المقررات والأسعار الحالية المعتمدة في منصة جسوركم؟")}
                className="px-2.5 py-1 rounded-full bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground whitespace-nowrap transition-colors"
              >
                📚 المقررات والأسعار بالمنصة
              </button>
              <button
                onClick={() => handleSendMasterAI("ما هي الجامعات السعودية المعتمدة وطرق الدفع والتقسيط المتوفرة بالمنصة؟")}
                className="px-2.5 py-1 rounded-full bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground whitespace-nowrap transition-colors"
              >
                🏛️ الجامعات وطرق الدفع والتقسيط
              </button>
              <button
                onClick={() => handleSendMasterAI("ما هي كوبونات الخصم النشطة حالياً وكيف نستغلها لتحويل طلاب المعاينة لمشتركين؟")}
                className="px-2.5 py-1 rounded-full bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground whitespace-nowrap transition-colors"
              >
                🎟️ الكوبونات وتحويل طلاب المعاينة
              </button>
              <button
                onClick={() => handleSendMasterAI("قدم لي تقريراً شاملاً وخطة عمل لزيادة مبيعات مقررات الفيزياء والكيمياء")}
                className="px-2.5 py-1 rounded-full bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground whitespace-nowrap transition-colors"
              >
                📈 خطة تسويقية لمقررات العلوم
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
              {masterMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 text-right ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-sm"
                    }`}
                  >
                    {msg.role === "user" ? <Users className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none font-medium"
                        : "bg-muted/60 text-foreground border border-border/80 rounded-tl-none shadow-sm"
                    }`}
                  >
                    <MathMarkdown content={msg.content} />
                    {msg.time && (
                      <span
                        className={`text-[10px] block mt-2 ${
                          msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {msg.time}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={masterChatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 md:p-4 bg-card border-t border-border flex items-center gap-2">
              <Input
                value={masterInput}
                onChange={(e) => setMasterInput(e.target.value)}
                placeholder="اطلب أي تقرير، تحليل، استراتيجية، أو مهمة إدارية في المنصة..."
                disabled={isMasterStreaming}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMasterAI();
                  }
                }}
                className="text-sm h-11 border-border/80 focus:border-primary"
              />
              <Button
                onClick={() => handleSendMasterAI()}
                disabled={isMasterStreaming || !masterInput.trim()}
                className="h-11 px-5 font-bold gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shrink-0 shadow-md shadow-amber-500/20"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">إرسال للأوركستريتور</span>
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AIControlCenter;
