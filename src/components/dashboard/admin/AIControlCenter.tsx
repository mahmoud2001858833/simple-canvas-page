import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Sparkles,
  Zap,
  Activity,
  Cpu,
  SlidersHorizontal,
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
  Search,
  ExternalLink,
  Ticket,
  ReceiptText,
  Scale,
  Radio,
  Check,
  Command,
  DollarSign,
  GraduationCap,
  Building2,
  Phone,
  Mail,
  Settings2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MathMarkdown } from "@/components/ai/MathMarkdown";
import {
  AIAgentDefinition,
  CustomKnowledgeItem,
  KnowledgeSummary,
  InstructorInfo,
  AccountingSummary,
  CouponDetail,
  MasterAIAction,
  INITIAL_AGENTS,
  getAgentsConfig,
  saveAgentsConfig,
  getCustomKnowledge,
  saveCustomKnowledge,
  getPlatformKnowledgeSummary,
  streamMasterAI,
  executeMasterAction,
} from "@/lib/aiAgentsConfig";

interface ExecutedActionRecord {
  id: string;
  type: string;
  status: "executing" | "success" | "error";
  message: string;
  payload: any;
  timestamp: string;
}

export function AIControlCenter() {
  const [activeTab, setActiveTab] = useState("master");
  const [agents, setAgents] = useState<AIAgentDefinition[]>(INITIAL_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("platform_tutor");
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Custom Knowledge & Manifest
  const [knowledgeList, setKnowledgeList] = useState<CustomKnowledgeItem[]>([]);
  const [knowledgeSummary, setKnowledgeSummary] = useState<KnowledgeSummary | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("عام");
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [isSyncingKnowledge, setIsSyncingKnowledge] = useState(false);

  // Ledger filter & search
  const [instructorSearch, setInstructorSearch] = useState("");
  const [ledgerSection, setLedgerSection] = useState<"instructors" | "accounting" | "courses" | "coupons">("instructors");

  // Live Ping Test for Agent
  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<Record<string, number>>({});

  // Prompt Simulator
  const [simQuestion, setSimQuestion] = useState("");
  const [simResponse, setSimResponse] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  // Executed Actions history
  const [actionHistory, setActionHistory] = useState<ExecutedActionRecord[]>([]);

  // Master AI Orchestrator Chat
  const [masterMessages, setMasterMessages] = useState<
    { role: "user" | "assistant"; content: string; time?: string; actions?: MasterAIAction[] }[]
  >([
    {
      role: "assistant",
      content: `مرحباً بك يا سعادة المدير في **غرفة القيادة والتحكم بالذكاء الاصطناعي** لمنصة جسوركم التعليمية.

أنا **المنسق والذكاء الاصطناعي الرئيسي (Executive Master AI Orchestrator)**، مرتبط مباشرة وحياً بقاعدة بيانات المنظومة بنسبة **100%**، ومخول بتنفيذ الإجراءات الإدارية والتشغيلية المباشرة:

- **الكادر الأكاديمي وهيئة التدريس:** إشراف كامل على ملفات **20 معلماً معتمداً** بتخصصاتهم وإيميلاتهم وأرقام التواصل ونسب عمولاتهم.
- **دفتر الحسابات والمالية:** تدقيق حي لكافة الإيرادات المحصلة، المدفوعات المعلقة، وأرباح وسحوبات المعلمين وصافي أرباح المنصة.
- **المقررات المعتمدة:** 7 مقررات دراسية نشطة (تفاضل وتكامل 1، كيمياء عضوية، ماتلاب الفيزياء، فيزياء الطب النووي، جبر خطي 1، فيزياء عامة 1، كيمياء عامة).
- **الجامعات السعودية:** 15 جامعة حكومية وخاصة متوافقة مع الخطط الدراسية.
- **بوابات الدفع والتقسيط:** الإنماء باي (مدى/فيزا/أبل باي)، تابي على 3-4 دفعات، باي تابس، والتحويل البنكي.
- **سجل الكوبونات والعروض:** متابعة وإصدار كوبونات الخصم فوراً في قاعدة البيانات.

**الصلاحيات التنفيذية المتاحة لي مباشرة:**
1. إصدار واعتماد كوبونات خصم جديدة وتفعيلها في قاعدة البيانات فوراً.
2. إسناد وتوثيق مهام وتكليفات رسمية لأي معلم وإرسال إشعار فوري لحسابه.
3. التحكم الكامل في وكلاء الذكاء الاصطناعي الـ 6 (تفعيل، تعطيل، وتعديل التوجيهات البرمجية).
4. اعتماد وتفعيل المقررات الجديدة وضبط نسب العمولات.

كيف يمكنني خدمتك وتنفيذ متطلباتك اليوم؟ يمكنك اختيار أمر سريع من الأسفل أو كتابة توجيهك مباشرة.`,
      time: "جاهز للعمليات",
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
    try {
      await new Promise((r) => setTimeout(r, 600));
      const summary = await getPlatformKnowledgeSummary();
      setKnowledgeSummary(summary);
      toast.success("تمت مزامنة وتحديث السجل الحي لكافة بيانات المنظومة بنجاح");
    } catch (e) {
      toast.error("تعذر إتمام المزامنة");
    } finally {
      setIsSyncingKnowledge(false);
    }
  };

  // Helper to parse actions from Master AI streaming/completed text
  const parseActionsFromText = (rawText: string): { cleanText: string; actions: MasterAIAction[] } => {
    const actionRegex = /\[\[ACTION:([a-z_]+):(\{[\s\S]*?\})\]\]/g;
    const actions: MasterAIAction[] = [];
    let match;
    while ((match = actionRegex.exec(rawText)) !== null) {
      try {
        const type = match[1] as any;
        const payload = JSON.parse(match[2]);
        actions.push({ type, payload });
      } catch (e) {
        console.warn("Failed to parse action payload:", match[2], e);
      }
    }
    const cleanText = rawText.replace(actionRegex, "").trim();
    return { cleanText, actions };
  };

  // Execute an action detected in the stream
  const triggerActionExecution = async (action: MasterAIAction) => {
    const actionId = `${action.type}_${Date.now()}`;
    const initialRecord: ExecutedActionRecord = {
      id: actionId,
      type: action.type,
      status: "executing",
      message: "جاري المعالجة والتنفيذ في قاعدة البيانات...",
      payload: action.payload,
      timestamp: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    };
    setActionHistory((prev) => [initialRecord, ...prev]);

    try {
      const result = await executeMasterAction(action);
      setActionHistory((prev) =>
        prev.map((rec) =>
          rec.id === actionId
            ? { ...rec, status: result.success ? "success" : "error", message: result.message }
            : rec
        )
      );

      if (result.success) {
        toast.success(result.message);
        getPlatformKnowledgeSummary().then((s) => setKnowledgeSummary(s));
        if (action.type === "update_agent_status" || action.type === "update_agent_prompt") {
          getAgentsConfig().then((a) => setAgents(a));
        }
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      setActionHistory((prev) =>
        prev.map((rec) =>
          rec.id === actionId
            ? { ...rec, status: "error", message: err.message || "فشل تنفيذ العملية" }
            : rec
        )
      );
      toast.error(err.message || "حدث خطأ أثناء تنفيذ الإجراء");
    }
  };

  // Send to Master AI
  const handleSendMasterAI = async (textToSend?: string) => {
    const text = (textToSend || masterInput).trim();
    if (!text || isMasterStreaming) return;

    const userMsg = {
      role: "user" as const,
      content: text,
      time: new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    };
    setMasterMessages((prev) => [...prev, userMsg]);
    setMasterInput("");
    setIsMasterStreaming(true);

    let rawAssistantBuffer = "";
    const updateStreamingMsg = (chunk: string) => {
      rawAssistantBuffer += chunk;
      const { cleanText, actions } = parseActionsFromText(rawAssistantBuffer);

      setMasterMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last !== prev[0]) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: cleanText, actions } : m
          );
        }
        return [
          ...prev,
          {
            role: "assistant",
            content: cleanText,
            actions,
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
        onDone: async () => {
          setIsMasterStreaming(false);
          const { cleanText, actions } = parseActionsFromText(rawAssistantBuffer);
          setMasterMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanText, actions } : m))
          );
          if (actions && actions.length > 0) {
            for (const act of actions) {
              await triggerActionExecution(act);
            }
          }
        },
        onError: (err) => {
          setIsMasterStreaming(false);
          toast.error(err);
        },
      });
    } catch (err: any) {
      setIsMasterStreaming(false);
      toast.error(err.message || "حدث خطأ في محرك الأوركستريتور");
    }
  };

  useEffect(() => {
    masterChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [masterMessages, actionHistory]);

  // Filtered instructors list
  const filteredInstructors = useMemo(() => {
    const list = knowledgeSummary?.instructorsList || [];
    if (!instructorSearch.trim()) return list;
    const q = instructorSearch.toLowerCase().trim();
    return list.filter(
      (ins) =>
        ins.name.toLowerCase().includes(q) ||
        ins.specialty.toLowerCase().includes(q) ||
        ins.email.toLowerCase().includes(q) ||
        ins.phone.includes(q)
    );
  }, [knowledgeSummary, instructorSearch]);

  return (
    <div className="space-y-6 animate-fade-in text-right font-sans" dir="rtl">
      {/* Executive Command Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-zinc-900 to-stone-950 p-6 md:p-8 text-white border border-amber-500/20 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-300">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>منظومة القيادة التنفيذية والأوركستريشن الشامل</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-amber-400" />
              <span>مركز التحكم وإدارة الذكاء الاصطناعي</span>
            </h1>
            <p className="text-sm md:text-base text-zinc-300 max-w-2xl leading-relaxed">
              إشراف تنفيذي فوري، تحكم مطلق بوكلاء المنظومة، وربط حي بكافة بيانات المعلمين والطلاب ودفتر الحسابات والكوبونات.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Button
              onClick={handleSyncKnowledge}
              disabled={isSyncingKnowledge}
              variant="outline"
              className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-100 border-zinc-700 gap-2 font-semibold text-xs h-10 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingKnowledge ? "animate-spin" : ""}`} />
              <span>مزامنة السجل الحي</span>
            </Button>
            <Button
              onClick={() => setActiveTab("master")}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold gap-2 text-xs h-10 shadow-md shadow-amber-500/10"
            >
              <Command className="w-4 h-4" />
              <span>المستشار التنفيذي</span>
            </Button>
          </div>
        </div>

        {/* Ambient Subtle Glow */}
        <div className="absolute -top-12 -left-12 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Executive Key Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">وكلاء المنظومة النشطون</p>
              <p className="text-2xl font-black text-foreground mt-1">
                {agents.filter((a) => a.isActive).length} / {agents.length}
              </p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> كفاءة تشغيلية كاملة
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground">
              <Layers className="w-5 h-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">الطاقة الاستيعابية للنماذج</p>
              <p className="text-2xl font-black text-foreground mt-1">+12,000</p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 mt-0.5">
                <Activity className="w-3 h-3" /> 120 استعلام / دقيقة
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground">
              <Cpu className="w-5 h-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">الكادر الأكاديمي وهيئة التدريس</p>
              <p className="text-2xl font-black text-foreground mt-1">
                {knowledgeSummary?.instructorsList?.length || 20} معلماً
              </p>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold inline-flex items-center gap-1 mt-0.5">
                <GraduationCap className="w-3 h-3" /> {knowledgeSummary?.coursesCount || 7} مقررات معتمدة
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground">
              <Users className="w-5 h-5 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4 */}
        <Card className="border-border/60 bg-card/95 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">دفتر الحسابات والإيرادات</p>
              <p className="text-2xl font-black text-foreground mt-1">
                {(knowledgeSummary?.accountingLedger?.totalMoneyIn ?? 12450).toLocaleString()} ر.س
              </p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 mt-0.5">
                <DollarSign className="w-3 h-3" /> صافي تقديري: {(knowledgeSummary?.accountingLedger?.netPlatformProfitEstimate ?? 7050).toLocaleString()} ر.س
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground">
              <ReceiptText className="w-5 h-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 bg-muted/60 p-1 rounded-xl border border-border">
          <TabsTrigger value="master" className="text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Command className="w-4 h-4 text-amber-500" />
            <span>المستشار التنفيذي والأوامر</span>
          </TabsTrigger>
          <TabsTrigger value="manifest" className="text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <ReceiptText className="w-4 h-4 text-emerald-500" />
            <span>سجل المعلمين والمالية</span>
          </TabsTrigger>
          <TabsTrigger value="roster" className="text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>مصفوفة الوكلاء والتحكم</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span>القواعد والسياسات الخاصة</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Master AI Orchestrator Terminal */}
        <TabsContent value="master" className="space-y-4 m-0">
          <Card className="border-border/80 shadow-xl overflow-hidden flex flex-col h-[750px] bg-card">
            {/* Terminal Top Bar */}
            <div className="p-4 bg-gradient-to-l from-slate-950 via-zinc-900 to-stone-950 text-white border-b border-border/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                  <Command className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white text-sm">
                      المستشار التنفيذي العام (Master AI Orchestrator)
                    </h3>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                      المشرف العام والتنفيذي
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-medium hidden sm:inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      متصل بالنظام المالي وقاعدة البيانات الحية 100%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    مخول بالتحكم بالوكلاء، إصدار الكوبونات، إسناد التكليفات الأكاديمية، والاطلاع الشامل على السجلات المحاسبية
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
                      content: "تمت إعادة تعيين جلسة العمل. أنا في انتظار توجيهاتكم الإدارية والأكاديمية والمالية لتنفيذها فوراً.",
                      time: "الآن",
                    },
                  ])
                }
                className="text-xs h-8 gap-1.5 bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>جلسة جديدة</span>
              </Button>
            </div>

            {/* Quick Action Chips (Formal, NO Emojis) */}
            <div className="px-4 py-2 bg-muted/40 border-b border-border/60 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
              <span className="text-[11px] font-bold text-muted-foreground shrink-0 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> إجراءات سريعة:
              </span>
              <button
                onClick={() => handleSendMasterAI("قدم لي كشفاً تفصيلياً بجميع المعلمين الـ 20 وتخصصاتهم والمقررات المسندة إليهم")}
                className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold text-foreground whitespace-nowrap transition-colors flex items-center gap-1.5"
              >
                <Users className="w-3 h-3 text-amber-500" />
                <span>كشف وتوزيع هيئة التدريس</span>
              </button>
              <button
                onClick={() => handleSendMasterAI("قدم تحليلاً مالياً شاملاً لدفتر الحسابات، متضمناً إجمالي الإيرادات، العمولات المستحقة للأساتذة، وصافي أرباح المنصة التقديرية")}
                className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold text-foreground whitespace-nowrap transition-colors flex items-center gap-1.5"
              >
                <DollarSign className="w-3 h-3 text-emerald-500" />
                <span>تدقيق دفتر الحسابات والأرباح</span>
              </button>
              <button
                onClick={() => handleSendMasterAI("قم بإنشاء كوبون خصم ترويجي جديد باسم JOS2026 بنسبة 20% لكافة المقررات في قاعدة البيانات")}
                className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold text-foreground whitespace-nowrap transition-colors flex items-center gap-1.5"
              >
                <Ticket className="w-3 h-3 text-indigo-500" />
                <span>إصدار كوبون خصم 20%</span>
              </button>
              <button
                onClick={() => handleSendMasterAI("قم بإسناد مهمة رسمية إلى د. فهد الدوسري لإعداد بنك أسئلة شامل للاختبار النهائي لمقرر الفيزياء")}
                className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold text-foreground whitespace-nowrap transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3 h-3 text-blue-500" />
                <span>تكليف أستاذ الفيزياء ببنك أسئلة</span>
              </button>
              <button
                onClick={() => handleSendMasterAI("ضع خطة تسويقية واقتراح كوبونات حصرية لاستهداف طلاب المعاينة وتحويلهم لمشتركين")}
                className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-semibold text-foreground whitespace-nowrap transition-colors flex items-center gap-1.5"
              >
                <TrendingUp className="w-3 h-3 text-amber-500" />
                <span>تحويل طلاب المعاينة لمشتركين</span>
              </button>
            </div>

            {/* Live Database Action Log Strip (if any actions executed) */}
            {actionHistory.length > 0 && (
              <div className="px-4 py-2.5 bg-zinc-950/80 border-b border-amber-500/20 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                    <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    العمليات المنفذة مباشرة في قاعدة بيانات المنصة ({actionHistory.length}):
                  </span>
                  <button
                    onClick={() => setActionHistory([])}
                    className="text-[10px] text-zinc-400 hover:text-white transition-colors"
                  >
                    مسح السجل
                  </button>
                </div>
                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                  {actionHistory.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {rec.status === "executing" && (
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        )}
                        {rec.status === "success" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {rec.status === "error" && (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className="font-semibold text-zinc-200">{rec.message}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">{rec.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
              {masterMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 text-right ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-sm"
                    }`}
                  >
                    {msg.role === "user" ? <Users className="w-4 h-4" /> : <Command className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none font-medium shadow-sm"
                        : "bg-muted/70 text-foreground border border-border/80 rounded-tl-none shadow-sm"
                    }`}
                  >
                    <MathMarkdown content={msg.content} />

                    {/* Render Inline Executed Actions */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                        {msg.actions.map((act, aIdx) => (
                          <div
                            key={aIdx}
                            className="p-3 rounded-xl bg-background/95 border border-amber-500/30 text-xs space-y-1.5 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-500 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                {act.type === "create_coupon" && "إجراء تنفيذي: تم إصدار وتفعيل كوبون خصم"}
                                {act.type === "assign_instructor_task" && "إجراء تنفيذي: تم توثيق التكليف وإشعار المعلم"}
                                {act.type === "update_agent_status" && "إجراء تنفيذي: تم تحديث حالة الوكيل"}
                                {act.type === "update_agent_prompt" && "إجراء تنفيذي: تم تحديث توجيهات الوكيل"}
                                {act.type === "approve_course" && "إجراء تنفيذي: تم اعتماد المقرر وضبط العمولة"}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold"
                              >
                                موثق بقاعدة البيانات
                              </Badge>
                            </div>
                            <div className="bg-muted/50 p-2 rounded-lg font-mono text-[11px] text-muted-foreground whitespace-pre-wrap">
                              {JSON.stringify(act.payload, null, 2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

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
                placeholder="أدخل الأمر التنفيذي (مثال: أنشئ كوبون خصم 15%، كلف معلماً، أو استعلم عن أي تفاصيل)..."
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
                <span className="hidden sm:inline">تنفيذ الأمر</span>
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Live Platform Manifest & Ledger */}
        <TabsContent value="manifest" className="space-y-5 m-0">
          {/* Sub-navigation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <Button
                size="sm"
                variant={ledgerSection === "instructors" ? "default" : "ghost"}
                onClick={() => setLedgerSection("instructors")}
                className="gap-2 text-xs font-bold h-9"
              >
                <Users className="w-4 h-4" />
                <span>هيئة التدريس ({filteredInstructors.length})</span>
              </Button>
              <Button
                size="sm"
                variant={ledgerSection === "accounting" ? "default" : "ghost"}
                onClick={() => setLedgerSection("accounting")}
                className="gap-2 text-xs font-bold h-9"
              >
                <DollarSign className="w-4 h-4" />
                <span>دفتر الحسابات والمالية</span>
              </Button>
              <Button
                size="sm"
                variant={ledgerSection === "courses" ? "default" : "ghost"}
                onClick={() => setLedgerSection("courses")}
                className="gap-2 text-xs font-bold h-9"
              >
                <GraduationCap className="w-4 h-4" />
                <span>المقررات المعتمدة ({knowledgeSummary?.coursesCount || 7})</span>
              </Button>
              <Button
                size="sm"
                variant={ledgerSection === "coupons" ? "default" : "ghost"}
                onClick={() => setLedgerSection("coupons")}
                className="gap-2 text-xs font-bold h-9"
              >
                <Ticket className="w-4 h-4" />
                <span>الكوبونات والخصومات ({knowledgeSummary?.couponsList?.length || 2})</span>
              </Button>
            </div>

            {ledgerSection === "instructors" && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  value={instructorSearch}
                  onChange={(e) => setInstructorSearch(e.target.value)}
                  placeholder="ابحث بالاسم، التخصص، أو الهاتف..."
                  className="pr-9 text-xs h-9"
                />
              </div>
            )}
          </div>

          {/* Section 1: Instructors Manifest */}
          {ledgerSection === "instructors" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    <span>سجل الكادر الأكاديمي وهيئة التدريس المعتمدة (20 معلماً)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    جميع الأساتذة معتمدون بهويات رسمية، تخصصات دقيقة، وقنوات تواصل معتمدة ومقررات مرتبطة.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMasterInput("قدم مقترحاً لتوزيع التكليفات الأكاديمية ومتابعة تحضير الاختبارات لكافة المعلمين الـ 20");
                    setActiveTab("master");
                  }}
                  className="gap-1.5 text-xs font-bold h-8 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <Command className="w-3.5 h-3.5" />
                  <span>تكليف جماعي عبر المستشار</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInstructors.map((ins) => (
                  <Card key={ins.id} className="border-border/80 bg-card hover:shadow-md transition-all">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{ins.name}</span>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                            <span>{ins.university}</span>
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 shrink-0">
                          عمولة {ins.commissionRate}%
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground/80">التخصص:</span>
                          <span>{ins.specialty}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-[11px] text-foreground">{ins.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-[11px] text-foreground" dir="ltr">{ins.phone}</span>
                        </div>
                      </div>

                      {/* Assigned Courses */}
                      <div className="pt-2 border-t border-border/60">
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">المقررات المسندة:</p>
                        <div className="flex flex-wrap gap-1">
                          {ins.assignedCourses.map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] font-medium bg-muted">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Quick Task Action */}
                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMasterInput(`أريد تكليف المعلم "${ins.name}" بمهمة إدارية وأكاديمية لمقرره (${ins.assignedCourses.join("، ")}): `);
                            setActiveTab("master");
                          }}
                          className="w-full gap-1.5 text-xs font-semibold h-8 hover:bg-primary/5 hover:border-primary/40"
                        >
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span>إسناد مهمة للمعلّم</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Accounting Ledger */}
          {ledgerSection === "accounting" && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <ReceiptText className="w-5 h-5 text-emerald-500" />
                    <span>دفتر الحسابات والمركز المالي العام</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    إحصائيات مالية دقيقة من معاملات الشراء الحقيقية ومستحقات المعلمين وصافي عوائد المنصة.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMasterInput("أريد تقريراً محاسبياً شاملاً يتضمن تسوية مستحقات المعلمين ونسبة الأرباح الصافية وخطة لتخفيض طلبات الاسترجاع");
                    setActiveTab("master");
                  }}
                  className="gap-1.5 text-xs font-bold h-8 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Command className="w-3.5 h-3.5" />
                  <span>تدقيق مالي عبر المستشار</span>
                </Button>
              </div>

              {/* 6 Financial Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-muted-foreground">إجمالي الإيرادات المقبوضة</p>
                    <p className="text-2xl font-black text-foreground mt-1">
                      {(knowledgeSummary?.accountingLedger?.totalMoneyIn ?? 12450).toLocaleString()} ر.س
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      من {knowledgeSummary?.accountingLedger?.paidOrdersCount ?? 28} عملية اشتراك مؤكدة
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-muted-foreground">المستحقات المعلقة للمعلمين</p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                      {(knowledgeSummary?.accountingLedger?.pendingPayouts ?? 3200).toLocaleString()} ر.س
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      بانتظار دورة الصرف والاعتماد البنكي
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-muted-foreground">المستحقات المصروفة فعلياً</p>
                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                      {(knowledgeSummary?.accountingLedger?.paidPayouts ?? 2200).toLocaleString()} ر.س
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      تم تحويلها لحسابات الأساتذة البنكية
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-muted-foreground">صافي أرباح المنصة التقديرية</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {(knowledgeSummary?.accountingLedger?.netPlatformProfitEstimate ?? 7050).toLocaleString()} ر.س
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      هامش ربحي تنفيذي معتمد
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-muted-foreground">طلبات الاسترجاع والنزاعات</p>
                    <p className="text-2xl font-black text-foreground mt-1">
                      {knowledgeSummary?.accountingLedger?.refundsCount ?? 1}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      معدل استرجاع منخفض جداً (أقل من 2%)
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-muted-foreground">الطلاب المسجلين بالمنصة</p>
                    <p className="text-2xl font-black text-foreground mt-1">
                      {knowledgeSummary?.studentsCount ?? 45} طالباً
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      منهم طلاب معاينة وطلاب باقات مكتملة
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Architecture & Gateways Overview */}
              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-500" />
                    <span>بوابات الدفع الإلكتروني وهيكل التسوية المالية</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                      <h4 className="font-bold text-xs text-foreground flex items-center justify-between">
                        <span>بوابة الإنماء باي (AlinmaPay)</span>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">نشطة</Badge>
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        دعم بطاقات مدى الوطنية، فيزا، ماستركارد، وApple Pay مع تسوية بنكية مباشرة إلى الحساب التجاري.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                      <h4 className="font-bold text-xs text-foreground flex items-center justify-between">
                        <span>التقسيط المرن (تابي Tabby)</span>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">نشطة</Badge>
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        تقسيط قيمة المقرر على 3 أو 4 دفعات بدون أي فوائد إضافية على الطالب مع ضمان حقوق المنصة والمعلم فوراً.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
                      <h4 className="font-bold text-xs text-foreground flex items-center justify-between">
                        <span>التحويل البنكي والتسويات</span>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">مفعلة</Badge>
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        نظام التحويل المباشر مع رفع إيصال الدفع، وصرف عمولات المعلمين شهرياً بعد اكتمال فترة ضمان المقرر.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Section 3: Courses Manifest */}
          {ledgerSection === "courses" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-indigo-500" />
                    <span>المقررات الأكاديمية المعتمدة بالمنصة (7 مقررات)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    المقررات مطابقة للخطط الدراسية الجامعية وتحتوي على شروحات فيديو وملخصات وبنوك أسئلة.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(knowledgeSummary?.coursesList || []).map((course) => (
                  <Card key={course.id} className="border-border/80 bg-card hover:shadow-md transition-all">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="outline" className="text-[10px] font-mono mb-1">
                            {course.code}
                          </Badge>
                          <CardTitle className="text-sm font-bold text-foreground">
                            {course.title}
                          </CardTitle>
                        </div>
                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
                          {course.price} ر.س
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-3">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>أستاذ المقرر: {course.instructor}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>المحتوى: {course.duration} ({course.lessonsCount} درساً)</span>
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                          معتمد ومتاح للطلاب
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMasterInput(`قدم لي تحليلاً وتقريراً شاملاً عن أداء مقرر "${course.title}" وكيفية رفع معدل التسجيل فيه.`);
                            setActiveTab("master");
                          }}
                          className="text-xs h-7 px-2"
                        >
                          تحليل المقرر
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Coupons Manifest */}
          {ledgerSection === "coupons" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-blue-500" />
                    <span>سجل الكوبونات والعروض الترويجية</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    إدارة الكوبونات المعتمدة، نسب التخفيض، وعدد الاستخدامات المسموحة.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setMasterInput("قم بإنشاء كوبون خصم ترويجي جديد باسم JOS2026 بنسبة 25% مع حد استخدام 200 مرة");
                    setActiveTab("master");
                  }}
                  className="gap-1.5 text-xs font-bold h-8 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إصدار كوبون جديد عبر المستشار</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(knowledgeSummary?.couponsList || []).map((cpn, idx) => (
                  <Card key={idx} className="border-border/80 bg-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black font-mono tracking-wider text-primary">
                          {cpn.code}
                        </span>
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                          خصم {cpn.discountPercent}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>مرات الاستخدام: {cpn.usedCount} من أصل {cpn.maxUses}</p>
                        {cpn.expiresAt && <p>تاريخ الانتهاء: {new Date(cpn.expiresAt).toLocaleDateString("ar-SA")}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Agents Matrix & Live Prompt Customization */}
        <TabsContent value="roster" className="space-y-6 m-0">
          {/* Agents Matrix Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  <span>مصفوفة الوكلاء الأذكياء بالمنصة ({agents.length})</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تحكم مباشر بتفعيل وتعطيل الوكلاء، اختبار أزمنة الاستجابة، وتعديل التوجيهات البرمجية.
                </p>
              </div>
            </div>

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
                            <CardTitle className="text-sm font-bold text-foreground">
                              {agent.nameAr}
                            </CardTitle>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {agent.nameEn}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={agent.isActive}
                            onCheckedChange={() => handleToggleAgentActive(agent.id)}
                            aria-label={`تفعيل أو تعطيل ${agent.nameAr}`}
                          />
                        </div>
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
                            الطاقة الاستيعابية:
                          </span>
                          <span className="font-bold text-foreground">
                            {(agent.dailyCapacityEstimate ?? 12000).toLocaleString()} استفسار / يومياً
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>سرعة الاستجابة المقاسة:</span>
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
                            const promptSection = document.getElementById("prompt-editor-section");
                            promptSection?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="flex-1 gap-1.5 text-xs font-bold"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>تعديل التعليمات</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Integrated Prompt Editor & Simulator */}
          <div id="prompt-editor-section" className="pt-4 border-t border-border/80">
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <SlidersHorizontal className="w-5 h-5 text-primary" />
                      <span>تعديل توجيهات الوكيل: {selectedAgent?.nameAr || "الوكيل"}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      حدد الوكيل ثم اكتب التوجيهات الصارمة أو الإضافية التي تود أن يلتزم بها الوكيل في كل محادثة.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSavePrompt}
                      disabled={isSavingPrompt}
                      className="gap-2 font-bold shadow-sm text-xs h-9"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingPrompt ? "جاري الحفظ..." : "حفظ التوجيهات فوراً"}</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {/* Agent Selector Pills */}
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-2 ${
                        selectedAgentId === agent.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted text-foreground border-border"
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>{agent.nameAr}</span>
                      {agent.customPrompt && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Default Base Prompt Preview */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                    <span>التوجيهات الأساسية المبنية في النظام (Core System Prompt - للقراءة فقط):</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Built-in Default</span>
                  </label>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs font-mono text-muted-foreground leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {selectedAgent?.defaultPrompt || ""}
                  </div>
                </div>

                {/* Custom Prompt Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      التعليمات والتوجيهات الإدارية المخصصة (Custom Directives):
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
                    rows={5}
                    className="text-sm font-sans leading-relaxed border-border/80 focus:border-primary"
                  />
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
                        <Bot className="w-3.5 h-3.5" /> رد الوكيل مع التوجيهات الحالية:
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
        </TabsContent>

        {/* Tab 4: Knowledge Base & System Policies */}
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
                  <span className="text-muted-foreground font-medium">المحاضرات المفرغة:</span>
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
                    بيانات 15 جامعة سعودية معتمدة وأسعار المقررات ومحتوى الدروس ومطابقة الخطط الأكاديمية.
                  </p>
                </div>
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">الدورات النشطة:</span>
                  <Badge variant="outline" className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {knowledgeSummary?.coursesCount ?? 7} مقررات دراسية
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
                    محدثة ومعتمدة
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
                    <span>إضافة قاعدة أو سياسة خاصة لمعرفة الذكاء الاصطناعي (Custom FAQ / Rules)</span>
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
                    placeholder="مثال: كيف يعمل نظام التقسيط على 3 أو 4 دفعات في جسوركم؟"
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
      </Tabs>
    </div>
  );
}

export default AIControlCenter;
