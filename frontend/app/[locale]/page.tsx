"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession, signIn } from "next-auth/react";
import { useParams } from "next/navigation";
import { useSidebar } from "../contexts/SidebarContext";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BotMessageSquare, Search, Compass, MapPin, Square } from "lucide-react";

function sanitizePlainText(input: string): string {
  // 伺服器端沒有 window，DOMPurify 在 SSR 時不可用；直接回傳原文字即可，
  // React 本身會自動轉義文字內容，client 端 hydrate 後才需要真正的淨化
  if (!DOMPurify.isSupported) return input;
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

interface PlanItem {
  sort: number;
  plan: string;
}

interface ChatMessage {
  role: "user" | "ai" | "error";
  content: string;
  sources?: SearchSource[];
  search_query?: string;
  tool_used?: string;
  plans?: PlanItem[];
}

const TOOL_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  weather_agent: {
    label: "天氣 Agent",
    color: "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      </svg>
    ),
  },
  financial_agent: {
    label: "財經 Agent",
    color: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  web_search: {
    label: "網路搜尋 Agent",
    color: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
  },
  travel_brainstormer: {
    label: "旅遊地點發想 Agent",
    color: "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400",
    icon: <Compass size={10} strokeWidth={2.5} />,
  },
  attractions_planner: {
    label: "景點規劃 Agent",
    color: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400",
    icon: <MapPin size={10} strokeWidth={2.5} />,
  },
};

function SourceCard({ source, index }: { source: SearchSource; index: number }) {
  const domain = (() => {
    try {
      return new URL(source.url).hostname.replace("www.", "");
    } catch {
      return source.url;
    }
  })();

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
            {source.title}
          </p>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1 truncate">{domain}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
            {source.snippet}
          </p>
        </div>
      </div>
    </a>
  );
}

function AnswerBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3 last:mb-0">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-600 dark:text-gray-400">{children}</em>
        ),
        ol: ({ children }) => (
          <ol className="space-y-2 mb-3 last:mb-0 pl-1">{children}</ol>
        ),
        ul: ({ children }) => (
          <ul className="space-y-2 mb-3 last:mb-0 pl-1">{children}</ul>
        ),
        li: ({ children }) => (
          <li className="flex gap-2.5 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            <span className="mt-0.5 shrink-0 text-indigo-400 font-medium">▸</span>
            <span>{children}</span>
          </li>
        ),
        h1: ({ children }) => (
          <h1 className="text-base font-bold text-gray-900 dark:text-white mb-2 mt-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2 mt-4 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 mt-3 first:mt-0">{children}</h3>
        ),
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono text-indigo-600 dark:text-indigo-400">
            {children}
          </code>
        ),
        hr: () => <hr className="border-gray-200 dark:border-gray-700 my-3" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

const GUEST_TURN_LIMIT = 3;

type CalledTool = { tool: string; label: string };

function LoadingCard({ step, calledTool, t }: { step: number; calledTool: CalledTool | null; t: (key: string) => string }) {
  const toolMeta = calledTool ? TOOL_META[calledTool.tool] : null;
  const steps = [
    {
      label: calledTool ? `${calledTool.label} 處理中` : t("stepDecide"),
      icon: toolMeta ? (
        <span className="w-3 h-3 flex items-center justify-center">{toolMeta.icon}</span>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
      ),
    },
    {
      label: calledTool ? `調用 ${calledTool.label}` : t("stepSearch"),
      icon: toolMeta ? (
        <span className="w-3 h-3 flex items-center justify-center">{toolMeta.icon}</span>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      label: t("stepGenerate"),
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-900/50">
      <div className="flex items-center gap-2 mb-5">
        <BotMessageSquare className="w-5 h-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("aiAnswer")}</span>
        <svg className="ml-auto animate-spin w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>

      <div className="space-y-2.5 mb-5">
        {steps.slice(0, step + 1).map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={i}
              className="flex items-center gap-3 transition-all duration-300 opacity-100"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                  done ? "bg-green-500 text-white" : "bg-indigo-500 text-white"
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="animate-spin w-2.5 h-2.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${active ? "text-indigo-600 dark:text-indigo-400 font-medium" : "text-gray-500 dark:text-gray-400 line-through"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 animate-pulse">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-5/6" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-4/5" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
      </div>
    </div>
  );
}

function formatPlanStep(plan: string, t: (key: string, values?: Record<string, string>) => string): string {
  if (plan.startsWith("routing:")) return t("stepDecide");
  if (plan.startsWith("tool_selected:")) {
    const toolId = plan.slice("tool_selected:".length).trim();
    const label = TOOL_META[toolId]?.label ?? toolId;
    return t("toolInvoked", { tool: label });
  }
  if (plan.startsWith("executing:")) return t("stepGenerate");
  return plan;
}

function ThinkingProcess({ plans, t }: { plans?: PlanItem[]; t: (key: string, values?: Record<string, string>) => string }) {
  const [open, setOpen] = useState(false);
  if (!plans || plans.length === 0) return null;
  const sorted = [...plans].sort((a, b) => a.sort - b.sort);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span>{t("thinkingProcess")}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-2.5 space-y-2 border-t border-[var(--border)]">
          {sorted.map((p, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span>{formatPlanStep(p.plan, t)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoginGate({ onGuest }: { onGuest: () => void }) {
  const [signingIn, setSigningIn] = useState(false);
  const t = useTranslations("webSearch");
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)] px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("loginTitle")}</h1>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            {t("loginSubtitle")}
          </p>
        </div>

        {/* Google sign-in button */}
        <button
          onClick={() => { setSigningIn(true); signIn("google"); }}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-[var(--foreground)] transition-colors shadow-sm disabled:opacity-60"
        >
          {signingIn ? (
            <svg className="animate-spin w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span>{signingIn ? t("signingIn") : t("signInGoogle")}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">{t("orDivider")}</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Guest continue button */}
        <div className="space-y-2">
          <button
            onClick={onGuest}
            className="w-full px-5 py-3 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-[var(--border)] transition-colors"
          >
            {t("continueAsGuest")}
          </button>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {t("guestNote")}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const { collapsed } = useSidebar();
  const t = useTranslations("webSearch");
  const { data: session, status } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [calledTool, setCalledTool] = useState<CalledTool | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const plansRef = useRef<{ sort: number; plan: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    if (window.matchMedia("(max-width: 640px)").matches) setIsMobile(true);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("guestMode") === "1") setGuestMode(true);

    // signIn() 會整頁導轉到 Google 再導回來，React state（包含 messages）會被重置，
    // 所以訪客對話要先暫存在 sessionStorage，回來後在這裡復原
    const savedGuestMessages = sessionStorage.getItem("guestMessages");
    if (savedGuestMessages) {
      try {
        setMessages(JSON.parse(savedGuestMessages));
      } catch {
        // 忽略解析失敗
      }
      sessionStorage.removeItem("guestMessages");
    }
  }, []);

  const handleContinueAsGuest = () => {
    sessionStorage.setItem("guestMode", "1");
    setGuestMode(true);
  };

  const handleGuestSignIn = () => {
    sessionStorage.setItem("guestMessages", JSON.stringify(messages));
    signIn("google");
  };

  // 訪客登入成功後解除訪客模式限制；對話內容保留，會在下一次提問時連同新 session 一併存入 DB
  useEffect(() => {
    if (status === "authenticated" && guestMode) {
      sessionStorage.removeItem("guestMode");
      setGuestMode(false);
    }
  }, [status, guestMode]);

  const guestQuestionCount = messages.filter((m) => m.role === "user").length;
  const guestLimitReached = guestMode && guestQuestionCount >= GUEST_TURN_LIMIT;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (isSubmittingRef.current || guestLimitReached) return;

    const safeQuery = sanitizePlainText(query.trim());
    if (!safeQuery) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setLoadingStep(0);
    setCalledTool(null);
    plansRef.current = [];
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMessages((prev) => [...prev, { role: "user", content: safeQuery }]);
    setQuery("");

    // ── 送出前先建立 session，取得 ID 後立即更新 URL
    // 若先前有訪客模式問過的對話（尚未存檔），一併帶入這個新 session
    const priorMessages = messages
      .filter((m) => m.role === "user" || m.role === "ai")
      .map((m) =>
        m.role === "ai"
          ? {
              role: "assistant",
              content: m.content,
              model_name: "llama-3.3-70b-versatile",
              tool_used: m.tool_used ?? null,
              search_query: m.search_query ?? null,
              sources: m.sources ?? [],
            }
          : { role: "user", content: m.content }
      );

    let sid = currentSessionId;
    let isNewSession = false;
    if (!sid && session?.user?.email) {
      try {
        const sessionRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: session.user.id,
            user_email: session.user.email,
            messages: [...priorMessages, { role: "user", content: safeQuery }],
          }),
        });
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          sid = sessionData.id;
          setCurrentSessionId(sessionData.id);
          window.history.pushState({}, "", `/${locale}/session/${sessionData.id}`);
          isNewSession = true;
        }
      } catch {
        // session 建立失敗不阻止搜尋
      }
    }

    // 帶入先前的問答紀錄，讓後端具備同一 session 的上下文記憶
    const history = messages
      .filter((m) => m.role === "user" || m.role === "ai")
      .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

    const persistTurn = (aiMsg: ChatMessage) => {
      if (!(session?.user?.email && sid)) return;
      const aiPayload = {
        role: "assistant",
        content: aiMsg.content,
        model_name: "llama-3.3-70b-versatile",
        tool_used: aiMsg.tool_used ?? null,
        search_query: aiMsg.search_query ?? null,
        sources: aiMsg.sources ?? [],
        plans: plansRef.current,
      };

      (async () => {
        try {
          // 新 session：user 訊息已在建立時存入，這裡只追加 AI 回應
          // 既有 session：同時追加 user 與 AI
          const messagesToSave = isNewSession
            ? [aiPayload]
            : [{ role: "user", content: safeQuery }, aiPayload];

          await fetch(`/api/sessions/${sid}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messagesToSave }),
          });

          window.dispatchEvent(new CustomEvent("conversation-saved"));

          // 標題只在建立 session 的第一輪（含訪客登入後補存的第一輪）自動命名一次，
          // 並帶入完整對話（含訪客期間的前幾輪），讓標題涵蓋整段脈絡而非只有最新一輪
          if (isNewSession) {
            const fullConversation = [
              ...history,
              { role: "user", content: safeQuery },
              { role: "assistant", content: aiMsg.content },
            ];
            fetch(`/api/sessions/${sid}/title`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: fullConversation }),
            })
              .then(() => window.dispatchEvent(new CustomEvent("conversation-saved")))
              .catch(() => {});
          }
        } catch {
          // 儲存失敗不影響主流程
        }
      })();
    };

    try {
      const res = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: safeQuery, history, session_id: sid }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t("errorGeneric"));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }

          if (event.type === "routing") {
            plansRef.current = [{ sort: 1, plan: "routing: 分析問題決策工具" }];
            if (event.tool) {
              setCalledTool({ tool: event.tool as string, label: event.label as string });
            } else {
              setCalledTool(null);
            }
            setLoadingStep(0);
          } else if (event.type === "tool_selected") {
            plansRef.current = [...plansRef.current, { sort: 2, plan: `tool_selected: ${event.tool}` }];
            setCalledTool({ tool: event.tool as string, label: event.label as string });
            setLoadingStep(1);
          } else if (event.type === "executing") {
            plansRef.current = [...plansRef.current, { sort: 3, plan: "executing: 生成答案" }];
            setLoadingStep(2);
          } else if (event.type === "done") {
            const newAiMsg: ChatMessage = {
              role: "ai",
              content: event.answer as string,
              sources: event.sources as SearchSource[],
              search_query: event.search_query as string,
              tool_used: event.tool_used as string,
              plans: [...plansRef.current],
            };
            setMessages((prev) => [...prev, newAiMsg]);
            persistTurn(newAiMsg);

            break outer;
          } else if (event.type === "error") {
            throw new Error(event.message as string);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const interruptedMsg: ChatMessage = { role: "ai", content: t("interrupted"), plans: [...plansRef.current] };
        setMessages((prev) => [...prev, interruptedMsg]);
        persistTurn(interruptedMsg);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            content: err instanceof Error ? err.message : t("errorGeneric"),
          },
        ]);
      }
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
      setCalledTool(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  if (status === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <svg className="animate-spin w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </main>
    );
  }

  if (status === "unauthenticated" && !guestMode) {
    return <LoginGate onGuest={handleContinueAsGuest} />;
  }

  const hasMessages = messages.length > 0;
  const px = collapsed ? "px-6" : "px-4 sm:px-6";

  return (
    <main className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Fixed title — 緊靠 sidebar 右側，垂直置中於 h-14 */}
      <div
        className={`fixed top-0 z-10 flex items-center gap-2.5 h-14 px-4 transition-all duration-300 ${
          collapsed ? 'left-16' : 'left-[80vw] md:left-56'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow shadow-indigo-500/30 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight whitespace-nowrap">
          {t("title")}
        </h1>
      </div>

      {/* Messages area */}
      <div className={`flex-1 max-w-2xl mx-auto w-full pt-20 pb-36 space-y-6 ${px}`}>
        {/* Empty state */}
        {!hasMessages && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
            <Search className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">{t("emptyState")}</p>
            <p className="text-xs mt-1 opacity-60">{t("hint")}</p>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, idx) => {
          if (msg.role === "user") {
            return (
              <div key={idx} className="flex justify-end">
                <div
                  className="max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed break-words select-text"
                  style={{
                    backgroundColor: "rgb(99 102 241 / 0.12)",
                    color: "inherit",
                    borderRadius: "16px 16px 16px 16px",
                  }}
                >
                  <span className="text-gray-800 dark:text-gray-100">{msg.content}</span>
                </div>
              </div>
            );
          }

          if (msg.role === "error") {
            return (
              <div key={idx} className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
                {msg.content}
              </div>
            );
          }

          // AI message
          return (
            <div key={idx} className="space-y-4">
              {/* AI header */}
              <div className="flex items-center gap-2 flex-wrap">
                <BotMessageSquare className="w-5 h-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("aiAnswer")}</span>

                {/* Tool used badge */}
                {msg.tool_used && TOOL_META[msg.tool_used] && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${TOOL_META[msg.tool_used].color}`}>
                    {TOOL_META[msg.tool_used].icon}
                    {TOOL_META[msg.tool_used].label}
                  </span>
                )}

                {/* Search query badge (web_search only) */}
                {msg.tool_used === "web_search" && msg.search_query && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    {msg.search_query}
                  </span>
                )}
              </div>

              {/* Thinking process (collapsible) */}
              <ThinkingProcess plans={msg.plans} t={t} />

              {/* Answer content */}
              <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-900/50">
                <AnswerBlock text={msg.content} />
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    {t("sources")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {msg.sources.map((s, i) => (
                      <SourceCard key={i} source={s} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Loading state inline in chat */}
        {loading && <LoadingCard step={loadingStep} calledTool={calledTool} t={t} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Fixed bottom input bar */}
      <div className="fixed bottom-0 left-16 right-0 bg-[var(--card)] border-t border-[var(--border)] py-4">
        <div className={`max-w-2xl mx-auto pl-[2px] pr-4 sm:pr-6`}>
          {guestLimitReached ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] text-center sm:text-left">
              <p className="text-sm text-[var(--muted)]">訪客模式已達 {GUEST_TURN_LIMIT} 輪對話上限，請登入以繼續</p>
              <button
                onClick={handleGuestSignIn}
                className="flex-shrink-0 w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
              >
                使用 Google 登入
              </button>
            </div>
          ) : (
          <form onSubmit={handleSearch} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder={isMobile ? t("placeholderShort") : t("placeholder")}
              disabled={loading}
              className="w-full pl-6 py-3.5 pr-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-200 disabled:opacity-60"
            />
            <button
              type={loading ? "button" : "submit"}
              onClick={loading ? handleStop : undefined}
              disabled={!loading && !query.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white disabled:text-gray-400 transition-colors flex items-center justify-center"
              aria-label={loading ? t("stopBtn") : t("searchBtn")}
            >
              {loading ? (
                <Square size={18} fill="currentColor" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </form>
          )}
        </div>
      </div>
    </main>
  );
}
