"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSidebar } from "../../../contexts/SidebarContext";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BotMessageSquare } from "lucide-react";

function sanitizePlainText(input: string): string {
  // 伺服器端沒有 window，DOMPurify 在 SSR 時不可用；直接回傳原文字即可，
  // React 本身會自動轉義文字內容，client 端 hydrate 後才需要真正的淨化
  if (!DOMPurify.isSupported) return input;
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Source {
  title: string;
  url: string;
  snippet: string;
}

interface DisplayMessage {
  role: "user" | "assistant" | "error";
  content: string;
  tool_used?: string;
  search_query?: string;
  sources?: Source[];
}

// ── Tool metadata ─────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  get_weather: {
    label: "即時天氣 MCP",
    color: "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      </svg>
    ),
  },
  get_weather_forecast: {
    label: "天氣預報 MCP",
    color: "bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      </svg>
    ),
  },
  esun_exchange_rate: {
    label: "匯率 MCP",
    color: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  web_search: {
    label: "網路搜尋",
    color: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SourceCard({ source, index }: { source: Source; index: number }) {
  const domain = (() => {
    try { return new URL(source.url).hostname.replace("www.", ""); }
    catch { return source.url; }
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
        p: ({ children }) => <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
        ol: ({ children }) => <ol className="space-y-2 mb-3 last:mb-0 pl-1">{children}</ol>,
        ul: ({ children }) => <ul className="space-y-2 mb-3 last:mb-0 pl-1">{children}</ul>,
        li: ({ children }) => (
          <li className="flex gap-2.5 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            <span className="mt-0.5 shrink-0 text-indigo-400 font-medium">▸</span>
            <span>{children}</span>
          </li>
        ),
        h1: ({ children }) => <h1 className="text-base font-bold text-gray-900 dark:text-white mb-2 mt-4 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2 mt-4 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 mt-3 first:mt-0">{children}</h3>,
        code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono text-indigo-600 dark:text-indigo-400">{children}</code>,
        hr: () => <hr className="border-gray-200 dark:border-gray-700 my-3" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

type CalledTool = { tool: string; label: string };

function LoadingCard({ step, calledTool, t }: { step: number; calledTool: CalledTool | null; t: (key: string) => string }) {
  const toolMeta = calledTool ? TOOL_META[calledTool.tool] : null;
  const steps = [
    {
      label: t("stepDecide"),
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
    },
    {
      label: calledTool ? `調用 ${calledTool.label}` : t("stepSearch"),
      icon: toolMeta
        ? <span className="w-3 h-3 flex items-center justify-center">{toolMeta.icon}</span>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
    },
    {
      label: t("stepGenerate"),
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
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
        {steps.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${done || active ? "opacity-100" : "opacity-25"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${done ? "bg-green-500 text-white" : active ? "bg-indigo-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : active ? (
                  <svg className="animate-spin w-2.5 h-2.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                ) : (
                  <span className="text-gray-400">{s.icon}</span>
                )}
              </div>
              <span className={`text-sm ${active ? "text-indigo-600 dark:text-indigo-400 font-medium" : done ? "text-gray-500 dark:text-gray-400 line-through" : "text-gray-400 dark:text-gray-600"}`}>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { collapsed } = useSidebar();
  const t = useTranslations("webSearch");

  const sessionId = params.sessionId as string;

  // ── Page load state
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");

  // ── Conversation state
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [calledTool, setCalledTool] = useState<CalledTool | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const plansRef = useRef<{ sort: number; plan: string }[]>([]);

  // ── Load session history
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.replace("/"); return; }

    const load = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        if (res.status === 404) { setPageError("找不到此對話紀錄"); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSessionTitle(data.title);
        setMessages(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.messages as any[]).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            tool_used: m.tool_used,
            search_query: m.search_query,
            sources: m.sources ?? [],
          }))
        );
      } catch {
        setPageError("載入對話紀錄失敗，請稍後再試");
      } finally {
        setPageLoading(false);
      }
    };
    load();
  }, [sessionId, status, router]);

  // ── Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Focus input
  useEffect(() => {
    if (!pageLoading) inputRef.current?.focus();
  }, [pageLoading]);

  // ── Search handler (continues existing session)
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmittingRef.current) return;

    const safeQuery = sanitizePlainText(query.trim());
    if (!safeQuery) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setLoadingStep(0);
    setCalledTool(null);
    plansRef.current = [];
    setMessages((prev) => [...prev, { role: "user", content: safeQuery }]);
    setQuery("");

    // 帶入先前的問答紀錄，讓後端具備同一 session 的上下文記憶
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: safeQuery, history }),
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
          try { event = JSON.parse(payload); } catch { continue; }

          if (event.type === "routing") {
            plansRef.current = [{ sort: 1, plan: "routing: 分析問題決策工具" }];
            setLoadingStep(0);
          } else if (event.type === "tool_selected") {
            plansRef.current = [...plansRef.current, { sort: 2, plan: `tool_selected: ${event.tool}` }];
            setCalledTool({ tool: event.tool as string, label: event.label as string });
            setLoadingStep(1);
          } else if (event.type === "executing") {
            plansRef.current = [...plansRef.current, { sort: 3, plan: "executing: 生成答案" }];
            setLoadingStep(2);
          } else if (event.type === "done") {
            const newAiMsg: DisplayMessage = {
              role: "assistant",
              content: event.answer as string,
              sources: event.sources as Source[],
              search_query: event.search_query as string,
              tool_used: event.tool_used as string,
            };
            setMessages((prev) => [...prev, newAiMsg]);

            // Append to existing session
            if (session?.user?.email) {
              const aiPayload = {
                role: "assistant",
                content: newAiMsg.content,
                model_name: "llama-3.3-70b-versatile",
                tool_used: newAiMsg.tool_used ?? null,
                search_query: newAiMsg.search_query ?? null,
                sources: newAiMsg.sources ?? [],
                plans: plansRef.current,
              };
              // 標題已在建立 session 的第一輪自動命名過，這裡只需要追加訊息
              fetch(`/api/sessions/${sessionId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [{ role: "user", content: safeQuery }, aiPayload],
                }),
              })
                .then(() => window.dispatchEvent(new CustomEvent("conversation-saved")))
                .catch(() => {});
            }

            break outer;
          } else if (event.type === "error") {
            throw new Error(event.message as string);
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", content: err instanceof Error ? err.message : t("errorGeneric") }]);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
      setCalledTool(null);
    }
  };

  const px = collapsed ? "px-6" : "px-4 sm:px-6";

  // ── Auth / page loading
  if (status === "loading" || pageLoading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <svg className="animate-spin w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)] gap-4">
        <p className="text-sm text-[var(--muted)]">{pageError}</p>
        <button onClick={() => router.push("/")} className="text-sm text-indigo-500 hover:underline">
          返回首頁
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Fixed title — 緊靠 sidebar 右側 */}
      <div
        className={`fixed top-0 z-10 flex items-center h-14 px-4 transition-all duration-300 ${
          collapsed ? 'left-16' : 'left-[80vw] md:left-56'
        }`}
      >
        <h1 className="text-base font-semibold text-[var(--foreground)] leading-tight whitespace-nowrap">
          {sessionTitle}
        </h1>
      </div>

      {/* Messages area */}
      <div className={`flex-1 max-w-2xl mx-auto w-full pt-20 pb-36 space-y-6 ${px}`}>
        {messages.map((msg, idx) => {
          if (msg.role === "user") {
            return (
              <div key={idx} className="flex justify-end">
                <div
                  className="max-w-[80%] px-5 py-3 text-sm leading-relaxed break-words select-text"
                  style={{ backgroundColor: "rgb(99 102 241 / 0.12)", borderRadius: "16px 16px 16px 16px" }}
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

          // assistant
          const meta = msg.tool_used ? TOOL_META[msg.tool_used] : null;
          return (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <BotMessageSquare className="w-5 h-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("aiAnswer")}</span>
                {meta && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.color}`}>
                    {meta.icon}{meta.label}
                  </span>
                )}
                {msg.tool_used === "web_search" && msg.search_query && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    {msg.search_query}
                  </span>
                )}
              </div>

              <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-900/50">
                <AnswerBlock text={msg.content} />
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                    </svg>
                    {t("sources")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {msg.sources.map((s, i) => <SourceCard key={i} source={s} index={i} />)}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && <LoadingCard step={loadingStep} calledTool={calledTool} t={t} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Fixed bottom input bar */}
      <div className="fixed bottom-0 left-16 right-0 bg-[var(--card)] border-t border-[var(--border)] py-4">
        <div className={`max-w-2xl mx-auto pl-[2px] pr-4 sm:pr-6`}>
          <form onSubmit={handleSearch} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); }
              }}
              placeholder={t("placeholder")}
              disabled={loading}
              className="w-full pl-6 py-3.5 pr-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-200 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white disabled:text-gray-400 transition-colors flex items-center justify-center"
              aria-label={t("searchBtn")}
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
