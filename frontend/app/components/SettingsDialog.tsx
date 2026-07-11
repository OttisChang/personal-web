'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { usePathname, useRouter } from '../../i18n/navigation';
import ToggleSwitch from './ToggleSwitch';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [dark, setDark] = useState(false);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('settingsDialog');

  useEffect(() => {
    if (!open) return;
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(stored === 'dark' || (!stored && prefersDark));
  }, [open]);

  if (!open) return null;

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const switchLocale = (next: 'zh' | 'en') => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 md:p-8 w-[90vw] max-w-sm md:max-w-xl flex flex-col">
        <div className="flex items-start justify-between pb-5 md:pb-6 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-[var(--foreground)]">{t('title')}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div className="flex items-center justify-between py-5 md:py-6 border-b border-[var(--border)]">
          <div>
            <p className="text-sm md:text-base font-medium text-[var(--foreground)]">{t('darkMode')}</p>
            <p className="mt-0.5 text-xs md:text-sm text-[var(--muted)]">{t('darkModeDesc')}</p>
          </div>
          <ToggleSwitch checked={dark} onChange={toggleTheme} label={t('toggleDarkMode')} />
        </div>

        <div className="flex items-center justify-between pt-5 md:pt-6">
          <div>
            <p className="text-sm md:text-base font-medium text-[var(--foreground)]">{t('language')}</p>
            <p className="mt-0.5 text-xs md:text-sm text-[var(--muted)]">{t('languageDesc')}</p>
          </div>
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => switchLocale('zh')}
              disabled={isPending}
              aria-pressed={locale === 'zh'}
              className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors disabled:opacity-50 ${
                locale === 'zh'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              中文
            </button>
            <button
              type="button"
              onClick={() => switchLocale('en')}
              disabled={isPending}
              aria-pressed={locale === 'en'}
              className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors disabled:opacity-50 ${
                locale === 'en'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
