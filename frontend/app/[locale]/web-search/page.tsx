"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSidebar } from "../../contexts/SidebarContext";
import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 移除所有 HTML 標籤與屬性，只保留純文字
function sanitizePlainText(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResult {
  answer: string;
  sources: SearchSource[];
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
        li: ({ children, ...props }) => {
          const isOrdered = (props as { ordered?: boolean }).ordered;
          return (
            <li className="flex gap-2.5 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              <span className={`mt-0.5 shrink-0 font-medium ${isOrdered ? "text-indigo-500" : "text-indigo-400"}`}>
                {isOrdered ? "" : "▸"}
              </span>
              <span>{children}</span>
            </li>
          );
        },
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
      {/* Header */}
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

      {/* Steps */}
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

      {/* Skeleton */}
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
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 防重複送出：使用 ref 避免 re-render，finally 區塊無條件解鎖
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

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // 防重複送出：入口鎖定
    if (isSubmittingRef.current) return;

    // 先 sanitize → 再驗證 → 最後送 API
    const safeQuery = sanitizePlainText(query.trim());
    if (!safeQuery) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setResult(null);
    setError(null);

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

      const data: SearchResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      // 無條件解鎖
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Hero */}
      <section
        className={`relative overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50 to-gray-50 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-950 ${
          collapsed ? "px-6 py-20" : "px-4 sm:px-6 py-12 sm:py-16"
        }`}
      >
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-indigo-400/20 dark:bg-indigo-600/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-purple-400/20 dark:bg-purple-600/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "8s", animationDelay: "2s" }} />

        <div className="relative max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              {t("title")}
            </h1>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            {t("subtitle")}
          </p>

          <form onSubmit={handleSearch} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("placeholder")}
              disabled={loading}
              className="w-full px-5 py-4 pr-14 rounded-2xl border border-[var(--border)] bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-200 disabled:opacity-60"
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

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-600">{t("hint")}</p>
        </div>
      </section>

      {/* Results */}
      <div className={`max-w-2xl mx-auto py-10 space-y-8 ${collapsed ? "px-6" : "px-4 sm:px-6"}`}>
        {/* Loading card with steps */}
        {loading && <LoadingCard step={loadingStep} t={t} />}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Answer */}
        {result && (
          <>
            <section>
              <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                {t("aiAnswer")}

                {/* Tool call badge */}
                {result.search_query && (
                  <span className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-500 dark:text-indigo-400 font-normal">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    {result.search_query}
                  </span>
                )}
              </h2>
              <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-900/50">
                <AnswerBlock text={result.answer} />
              </div>
            </section>

            {result.sources.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  {t("sources")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.sources.map((s, i) => (
                    <SourceCard key={i} source={s} index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !result && !error && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-600">
            <svg className="w-10 h-10 mx-auto mb-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-sm">{t("emptyState")}</p>
          </div>
        )}
      </div>
    </main>
  );
}
