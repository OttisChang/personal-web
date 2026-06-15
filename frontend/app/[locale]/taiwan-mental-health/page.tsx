'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSidebar } from '../../contexts/SidebarContext';

type Locale = 'zh' | 'en';

interface LocaleText {
  zh: string;
  en: string;
}

interface Resource {
  id: number;
  name: LocaleText;
  category: string; // internal filter value (always Chinese)
  phone?: string;
  website?: string;
  description: LocaleText;
  hours: LocaleText;
  region: LocaleText;
  tags: { zh: string[]; en: string[] };
}

const CATEGORY_KEYS = ['all', 'hotline', 'medical'] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

// Internal filter values are always Chinese
const CATEGORY_FILTER_VALUE: Record<CategoryKey, string> = {
  all: '全部',
  hotline: '諮詢熱線',
  medical: '醫療資源',
};

const RESOURCES: Resource[] = [
  {
    id: 1,
    name: {
      zh: '台大醫院精神醫學部',
      en: 'NTU Hospital – Dept. of Psychiatry',
    },
    category: '醫療資源',
    phone: '02-2312-3456',
    website: 'https://www.ntuh.gov.tw',
    description: {
      zh: '提供精神科門診、心理治療、情感障礙、思覺失調及成癮醫學等全方位精神醫療服務。',
      en: 'Comprehensive psychiatric services including outpatient clinics, psychotherapy, mood disorders, schizophrenia, and addiction medicine.',
    },
    hours: {
      zh: '依門診時間表（需預約）',
      en: 'By appointment (see clinic schedule)',
    },
    region: { zh: '台北市', en: 'Taipei City' },
    tags: {
      zh: ['精神科', '心理治療', '成癮醫學', '醫療', '預約'],
      en: ['psychiatry', 'psychotherapy', 'addiction medicine', 'medical', 'appointment'],
    },
  },
  {
    id: 2,
    name: {
      zh: '男性關懷專線',
      en: "Men's Care Hotline",
    },
    category: '諮詢熱線',
    phone: '0800-013-999',
    description: {
      zh: '衛福部男性關懷專線，提供男性情緒支持、壓力紓解及家庭關係諮詢，免費撥打。',
      en: 'Ministry of Health & Welfare hotline for men — emotional support, stress relief, and family counseling. Free to call.',
    },
    hours: {
      zh: '每日 7:00–23:00 全年無休',
      en: 'Daily 7:00–23:00, year-round',
    },
    region: { zh: '全台', en: 'Nationwide' },
    tags: {
      zh: ['男性', '家庭', '情緒支持', '免費'],
      en: ['men', 'family', 'emotional support', 'free'],
    },
  },
  {
    id: 3,
    name: {
      zh: '台灣同志諮詢熱線協會',
      en: 'Taiwan Tongzhi Hotline Association',
    },
    category: '諮詢熱線',
    phone: '02-2392-1970',
    website: 'https://hotline.org.tw/',
    description: {
      zh: '台灣同志諮詢熱線，提供 LGBTQ+ 族群及其家人情感支持、法律諮詢與社會資源連結。',
      en: "Taiwan's LGBTQ+ hotline — emotional support, legal consultation, and community resources for LGBTQ+ individuals and their families.",
    },
    hours: {
      zh: '週一、四、五、六、日 19:00–22:00',
      en: 'Mon, Thu, Fri, Sat, Sun 19:00–22:00',
    },
    region: { zh: '全台', en: 'Nationwide' },
    tags: {
      zh: ['LGBTQ+', '同志', '情感支持', '家人'],
      en: ['LGBTQ+', 'queer', 'emotional support', 'family'],
    },
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  '危機熱線': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  '諮詢熱線': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  '社福機構': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  '線上資源': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  '醫療資源': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const CATEGORY_LABEL_EN: Record<string, string> = {
  '危機熱線': 'Crisis Hotline',
  '諮詢熱線': 'Hotline',
  '社福機構': 'Social Services',
  '線上資源': 'Online Resources',
  '醫療資源': 'Medical',
};

function ResourceCard({
  resource,
  locale,
  websiteLabel,
}: {
  resource: Resource;
  locale: Locale;
  websiteLabel: string;
}) {
  const categoryLabel =
    locale === 'en'
      ? (CATEGORY_LABEL_EN[resource.category] ?? resource.category)
      : resource.category;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-5 flex flex-col gap-3 hover:border-[var(--accent)] hover:shadow-md transition-all duration-200 dialog-shadow">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <h3 className="font-semibold text-[var(--foreground)] text-sm leading-snug break-words min-w-0">
          {resource.name[locale]}
        </h3>
        <span
          className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
            CATEGORY_COLORS[resource.category] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          {categoryLabel}
        </span>
      </div>

      <p className="text-xs text-[var(--muted)] leading-relaxed">{resource.description[locale]}</p>

      <div className="flex flex-col gap-1.5 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{resource.hours[locale]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{resource.region[locale]}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-auto pt-1">
        {resource.phone && (
          <a
            href={`tel:${resource.phone.replace(/-/g, '')}`}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {resource.phone}
          </a>
        )}
        {resource.website && (
          <a
            href={resource.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {websiteLabel}
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {resource.tags[locale].map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[var(--muted)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TaiwanMentalHealthPage() {
  const { collapsed } = useSidebar();
  const t = useTranslations('mentalHealth');
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = RESOURCES.filter((r) => {
    const matchCategory =
      activeCategory === 'all' || r.category === CATEGORY_FILTER_VALUE[activeCategory];
    const q = query.toLowerCase().trim();
    const matchQuery =
      !q ||
      r.name.zh.toLowerCase().includes(q) ||
      r.name.en.toLowerCase().includes(q) ||
      r.description[locale].toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.region[locale].toLowerCase().includes(q) ||
      r.tags[locale].some((tag) => tag.toLowerCase().includes(q)) ||
      r.phone?.replace(/-/g, '').includes(q.replace(/-/g, ''));
    return matchCategory && matchQuery;
  });

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setQuery(e.target.value);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height =
          Math.min(textareaRef.current.scrollHeight, 200) + 'px';
      }
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
    }
  };

  const clearQuery = useCallback(() => {
    setQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, []);

  const CATEGORY_BUTTON_LABEL: Record<CategoryKey, string> = {
    all: t('categoryAll'),
    hotline: t('categoryHotline'),
    medical: t('categoryMedical'),
  };

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">

      {/* Page Header */}
      <header className="px-4 sm:px-6 py-4 sm:py-6 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[var(--foreground)] leading-tight">
                {locale === 'en' ? (
                  <>
                    <span className="block sm:inline">Taiwan Mental</span>
                    <span className="block sm:inline">Health Resources</span>
                  </>
                ) : t('title')}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                {locale === 'zh' ? (
                  <>
                    <span className="block sm:inline">搜尋心理健康相關熱線、機構</span>
                    <span className="block sm:inline">與線上資源</span>
                  </>
                ) : t('subtitle')}
              </p>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-red-500 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {t('emergency')}
            </p>
          </div>
        </div>
      </header>

      {/* Category Filter */}
      <div className="px-4 sm:px-6 py-2 sm:py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150 ${
                activeCategory === key
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                  : 'bg-transparent border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              {CATEGORY_BUTTON_LABEL[key]}
              {key !== 'all' && (
                <span className="ml-1 opacity-60">
                  {RESOURCES.filter((r) => r.category === CATEGORY_FILTER_VALUE[key]).length}
                </span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--muted)] flex-shrink-0">
            {t('showing', { count: filtered.length, total: RESOURCES.length })}
          </span>
        </div>
      </div>

      {/* Resource Cards */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-5xl mx-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)] mb-4">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="text-[var(--muted)] text-sm">{t('notFound', { query })}</p>
              <button
                onClick={clearQuery}
                className="mt-3 text-xs text-[var(--accent)] hover:underline"
              >
                {t('clearSearch')}
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 ${collapsed ? 'md:grid-cols-3' : 'lg:grid-cols-3'}`}>
              {filtered.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  locale={locale}
                  websiteLabel={t('website')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Search */}
      <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-xl border border-[var(--border)] bg-[var(--background)] focus-within:border-[var(--accent)] transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              style={{ minHeight: '56px', maxHeight: '200px', borderRadius: '0.75rem' }}
              className="relative z-0 w-full bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none resize-none py-2 pl-4 pr-12 overflow-y-auto border-none scrollbar-thin"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
            />
            {query && (
              <button
                type="button"
                onClick={clearQuery}
                className="absolute right-3 top-3 p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors"
                aria-label={t('clearSearchLabel')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-2 text-center">
            {t('searchNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
