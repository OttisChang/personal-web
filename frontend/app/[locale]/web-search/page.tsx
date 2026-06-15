"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSidebar } from "../../contexts/SidebarContext";
import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function sanitizePlainText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

interface ChatMessage {
  role: "user" | "ai" | "error";
  content: string;
  sources?: SearchSource[];
  search_query?: string;
}

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

function LoadingCard({ step, t }: { step: number; t: (key: string) => string }) {
  const steps = [
    {
      label: t("stepSearch"),
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      label: t("stepAnalyze"),
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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
        <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
        </div>
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
            <div
              key={i}
              className={`flex items-center gap-3 transition-all duration-300 ${done || active ? "opacity-100" : "opacity-25"}`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : active ? (
                  <svg className="animate-spin w-2.5 h-2.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
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

export default function WebSearchPage() {
  const { collapsed } = useSidebar();
  const t = useTranslations("webSearch");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const t1 = setTimeout(() => setLoadingStep(1), 1800);
    const t2 = setTimeout(() => setLoadingStep(2), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (isSubmittingRef.current) return;

    const safeQuery = sanitizePlainText(query.trim());
    if (!safeQuery) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: safeQuery }]);
    setQuery("");

    try {
      const res = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: safeQuery }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || t("errorGeneric"));
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: data.answer,
          sources: data.sources,
          search_query: data.search_query,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content: err instanceof Error ? err.message : t("errorGeneric"),
        },
      ]);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const hasMessages = messages.length > 0;
  const px = collapsed ? "px-6" : "px-4 sm:px-6";

  return (
    <main className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-[var(--card)] border-b border-[var(--border)]">
        <div className={`max-w-2xl mx-auto flex items-center gap-2.5 py-[18px] ${px}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow shadow-indigo-500/30 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--foreground)] leading-tight">
            {t("title")}
          </h1>
        </div>
      </header>

      {/* Messages area */}
      <div className={`flex-1 max-w-2xl mx-auto w-full py-6 pb-36 space-y-6 ${px}`}>
        {/* Empty state */}
        {!hasMessages && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
            <svg className="w-12 h-12 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
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
                    borderRadius: "16px 16px 4px 16px",
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
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("aiAnswer")}</span>
                {msg.search_query && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    {msg.search_query}
                  </span>
                )}
              </div>

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
        {loading && <LoadingCard step={loadingStep} t={t} />}

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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
